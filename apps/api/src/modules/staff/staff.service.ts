import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { SupabaseService } from '../../database/supabase.service';
import { UserRole } from '@calyvia/shared';
import {
  CreateStaffAccountDto,
  UpdateStaffAccountDto,
  ResetStaffPasswordDto,
  UpdateStaffStatusDto,
} from './dto/staff.dto';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(private prisma: PrismaService) {}

  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Retrieves all staff accounts with their operational profiles, roles, and status
   * Supports searching by name or institutional email, and filtering by department, role, or status.
   */
  async getStaffAccounts(query?: {
    search?: string;
    department?: string;
    role?: string;
    status?: string;
  }) {
    try {
      if (this.prisma && this.prisma.user) {
        const users = await this.prisma.user.findMany({
          include: { staffProfile: true },
          orderBy: { createdAt: 'desc' },
        });

        let filtered = users;

        if (query?.search && query.search.trim()) {
          const q = query.search.trim().toLowerCase();
          filtered = filtered.filter(
            (u: any) =>
              (u.fullName && u.fullName.toLowerCase().includes(q)) ||
              (u.email && u.email.toLowerCase().includes(q)) ||
              (u.staffProfile?.jobTitle && u.staffProfile.jobTitle.toLowerCase().includes(q)),
          );
        }

        if (query?.department && query.department !== 'ALL') {
          filtered = filtered.filter(
            (u: any) => u.staffProfile?.department === query.department,
          );
        }

        if (query?.role && query.role !== 'ALL') {
          filtered = filtered.filter((u: any) => u.role === query.role);
        }

        if (query?.status && query.status !== 'ALL') {
          if (query.status === 'ACTIVE') {
            filtered = filtered.filter((u: any) => u.isActive && u.approvalStatus !== 'SUSPENDED' && u.approvalStatus !== 'DEACTIVATED');
          } else if (query.status === 'SUSPENDED') {
            filtered = filtered.filter((u: any) => u.approvalStatus === 'SUSPENDED' || (!u.isActive && u.approvalStatus !== 'DEACTIVATED'));
          } else if (query.status === 'DEACTIVATED') {
            filtered = filtered.filter((u: any) => u.approvalStatus === 'DEACTIVATED');
          }
        }

        return filtered.map((u: any) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          phone: u.phone,
          role: u.role,
          isActive: !!u.isActive,
          approvalStatus: u.approvalStatus || (u.isActive ? 'APPROVED' : 'SUSPENDED'),
          mustChangePassword: !!u.mustChangePassword,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          staffProfile: u.staffProfile
            ? {
                department: u.staffProfile.department,
                jobTitle: u.staffProfile.jobTitle,
                licenseNumber: u.staffProfile.licenseNumber,
                licenseBoard: u.staffProfile.licenseBoard,
                licenseExpiryDate: u.staffProfile.licenseExpiryDate,
                dateJoined: u.staffProfile.dateJoined,
              }
            : null,
        }));
      }
    } catch (err: any) {
      this.logger.error(`Staff directory retrieval failed: ${err.message}`);
    }
    return [];
  }

  /**
   * Compatibility method for clinical staff directory
   */
  async getStaffDirectory() {
    return this.getStaffAccounts();
  }

  /**
   * Administrator-controlled account provisioning:
   * Creates an employee account in both Supabase Auth and the institutional database,
   * associates the staff profile, and logs the administrative creation event.
   */
  async createStaffAccount(adminUser: any, dto: CreateStaffAccountDto) {
    const adminId = adminUser?.id || adminUser?.sub || 'SYSTEM';
    const adminRole = adminUser?.role || UserRole.SUPER_ADMIN;
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Authorization & Privilege Escalation Guards
    if (adminRole === UserRole.FACILITY_ADMIN && dto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Facility Administrators cannot provision Primary System Administrator (SUPER_ADMIN) accounts.',
      );
    }

    // 2. Validate institutional email and check for duplicate accounts
    let existingUser = null;
    try {
      if (this.prisma && this.prisma.user) {
        existingUser = await this.prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
      }
    } catch (err: any) {
      this.logger.warn(`Existing user pre-check notice: ${err.message}`);
    }

    if (existingUser) {
      throw new BadRequestException(
        `An institutional account with email address '${normalizedEmail}' already exists.`,
      );
    }

    // 3. Password policy enforcement
    if (!dto.initialPassword || dto.initialPassword.length < 8) {
      throw new BadRequestException('Initial temporary password must be at least 8 characters long.');
    }

    let supabaseAuthUserId: string | null = null;

    // 4. Provision in Supabase Auth via Admin API (trusted server-side operation)
    if (SupabaseService.staticClient) {
      try {
        const { data: authData, error: authError } =
          await SupabaseService.staticClient.auth.admin.createUser({
            email: normalizedEmail,
            password: dto.initialPassword,
            email_confirm: true,
            user_metadata: {
              role: dto.role,
              fullName: dto.fullName,
              department: dto.department,
            },
            app_metadata: {
              role: dto.role,
            },
          });

        if (authError) {
          // If auth user already exists in auth.users, try to get it
          if (authError.message.includes('already registered')) {
            throw new BadRequestException(
              `An authentication identity with email '${normalizedEmail}' already exists in Supabase Auth.`,
            );
          }
          this.logger.warn(`Supabase Auth admin createUser notice: ${authError.message}`);
        } else if (authData?.user) {
          supabaseAuthUserId = authData.user.id;
        }
      } catch (authErr: any) {
        if (authErr instanceof BadRequestException) throw authErr;
        this.logger.warn(`Supabase Auth admin API unavailable, proceeding with database provisioning: ${authErr.message}`);
      }
    }

    // 5. Generate secure Argon2id hash for database record
    const passwordHash = await this.hashPassword(dto.initialPassword);
    const initialStatus = dto.status || 'ACTIVE';
    const isActive = initialStatus === 'ACTIVE';
    const mustChangePassword = dto.mustChangePassword !== false;

    // 6. Persist user and staff profile inside database
    let createdUser: any = null;
    try {
      if (this.prisma && this.prisma.user) {
        const userData: any = {
          email: normalizedEmail,
          passwordHash,
          role: dto.role,
          fullName: dto.fullName.trim(),
          phone: dto.phone?.trim() || null,
          isActive,
          approvalStatus: isActive ? 'APPROVED' : 'SUSPENDED',
          mustChangePassword,
          approvedBy: adminId,
          approvedAt: new Date(),
        };

        if (supabaseAuthUserId) {
          userData.id = supabaseAuthUserId;
        }

        createdUser = await this.prisma.user.create({
          data: userData,
        });

        // Create accompanying staff profile
        if ((this.prisma as any).staffProfile) {
          await (this.prisma as any).staffProfile.create({
            data: {
              userId: createdUser.id,
              department: dto.department,
              jobTitle: dto.jobTitle,
              nationalIdEncrypted: 'ENC:ADMIN_PROVISIONED',
              licenseNumber: dto.licenseNumber || null,
              licenseBoard: dto.licenseBoard || null,
              licenseExpiryDate: dto.licenseExpiryDate ? new Date(dto.licenseExpiryDate) : null,
              dateJoined: new Date(),
            },
          });
        }

        // Record immutable audit event
        if ((this.prisma as any).auditLog) {
          await (this.prisma as any).auditLog.create({
            data: {
              userId: adminId,
              role: adminRole,
              action: 'STAFF_ACCOUNT_CREATED',
              entityName: 'users',
              entityId: createdUser.id,
              newValues: {
                targetEmail: normalizedEmail,
                assignedRole: dto.role,
                department: dto.department,
                jobTitle: dto.jobTitle,
                status: initialStatus,
                mustChangePassword,
                createdBy: adminId,
                createdAt: new Date().toISOString(),
              },
            },
          });
        }
      }
    } catch (dbErr: any) {
      // Rollback Supabase Auth user if database creation failed
      if (supabaseAuthUserId && SupabaseService.staticClient) {
        try {
          await SupabaseService.staticClient.auth.admin.deleteUser(supabaseAuthUserId);
        } catch (rollbackErr: any) {
          this.logger.error(`Rollback of Supabase Auth user failed: ${rollbackErr.message}`);
        }
      }
      this.logger.error(`Database account provisioning error: ${dbErr.message}`);
      throw new BadRequestException(`Failed to create staff record: ${dbErr.message}`);
    }

    return {
      success: true,
      message: `Staff account for '${dto.fullName}' (${normalizedEmail}) provisioned successfully with role '${dto.role}'.`,
      user: {
        id: createdUser?.id || supabaseAuthUserId,
        email: normalizedEmail,
        fullName: dto.fullName,
        role: dto.role,
        department: dto.department,
        jobTitle: dto.jobTitle,
        isActive,
        mustChangePassword,
      },
    };
  }

  /**
   * Updates an existing employee's details, professional licensing, and assigned role.
   */
  async updateStaffAccount(adminUser: any, targetUserId: string, dto: UpdateStaffAccountDto) {
    const adminId = adminUser?.id || adminUser?.sub || 'SYSTEM';
    const adminRole = adminUser?.role || UserRole.SUPER_ADMIN;

    let targetUser = null;
    if (this.prisma && this.prisma.user) {
      targetUser = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        include: { staffProfile: true },
      });
    }

    if (!targetUser) {
      throw new NotFoundException('Staff account not found.');
    }

    // Guard: Prevent non-super-admins from escalating to or modifying SUPER_ADMIN accounts
    if (adminRole === UserRole.FACILITY_ADMIN) {
      if (targetUser.role === UserRole.SUPER_ADMIN || dto.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Facility Administrators cannot modify accounts with System Administrator (SUPER_ADMIN) privileges.',
        );
      }
    }

    // Guard: Prevent administrators from modifying their own role
    if (targetUserId === adminId && dto.role && dto.role !== targetUser.role) {
      throw new ForbiddenException('Administrators cannot modify their own assigned system role.');
    }

    const userUpdates: any = { updatedAt: new Date() };
    if (dto.fullName) userUpdates.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) userUpdates.phone = dto.phone?.trim() || null;
    if (dto.role) userUpdates.role = dto.role;

    if (dto.status) {
      if (targetUserId === adminId && dto.status !== 'ACTIVE') {
        throw new BadRequestException('You cannot deactivate or suspend your own active administrator account.');
      }
      userUpdates.isActive = dto.status === 'ACTIVE';
      userUpdates.approvalStatus = dto.status === 'ACTIVE' ? 'APPROVED' : dto.status;
    }

    try {
      if (this.prisma && this.prisma.user) {
        await this.prisma.user.update({
          where: { id: targetUserId },
          data: userUpdates,
        });

        // Update profile
        if ((this.prisma as any).staffProfile) {
          const profileUpdates: any = {};
          if (dto.department) profileUpdates.department = dto.department;
          if (dto.jobTitle) profileUpdates.jobTitle = dto.jobTitle;
          if (dto.licenseNumber !== undefined) profileUpdates.licenseNumber = dto.licenseNumber;
          if (dto.licenseBoard !== undefined) profileUpdates.licenseBoard = dto.licenseBoard;
          if (dto.licenseExpiryDate !== undefined) {
            profileUpdates.licenseExpiryDate = dto.licenseExpiryDate ? new Date(dto.licenseExpiryDate) : null;
          }

          if (Object.keys(profileUpdates).length > 0) {
            if (targetUser.staffProfile) {
              await (this.prisma as any).staffProfile.update({
                where: { userId: targetUserId },
                data: profileUpdates,
              });
            } else {
              await (this.prisma as any).staffProfile.create({
                data: {
                  userId: targetUserId,
                  department: dto.department || 'Clinical Operations',
                  jobTitle: dto.jobTitle || 'Clinical Staff',
                  nationalIdEncrypted: 'ENC:ADMIN_PROVISIONED',
                  dateJoined: new Date(),
                  ...profileUpdates,
                },
              });
            }
          }
        }

        // Sync with Supabase Auth metadata
        if (SupabaseService.staticClient) {
          try {
            await SupabaseService.staticClient.auth.admin.updateUserById(targetUserId, {
              user_metadata: {
                fullName: dto.fullName || targetUser.fullName,
                role: dto.role || targetUser.role,
                department: dto.department || targetUser.staffProfile?.department,
              },
              app_metadata: {
                role: dto.role || targetUser.role,
              },
            });
          } catch (syncErr: any) {
            this.logger.warn(`Supabase Auth metadata sync notice: ${syncErr.message}`);
          }
        }

        // Record audit log
        if ((this.prisma as any).auditLog) {
          await (this.prisma as any).auditLog.create({
            data: {
              userId: adminId,
              role: adminRole,
              action: 'STAFF_ACCOUNT_UPDATED',
              entityName: 'users',
              entityId: targetUserId,
              newValues: {
                targetEmail: targetUser.email,
                updatedFields: { ...userUpdates, ...dto },
                updatedBy: adminId,
                updatedAt: new Date().toISOString(),
              },
            },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to update staff account: ${err.message}`);
      throw new BadRequestException('Failed to update staff account details.');
    }

    return {
      success: true,
      message: `Staff details for '${targetUser.fullName}' updated successfully.`,
    };
  }

  /**
   * Resets or re-provisions account credentials for an employee.
   */
  async resetStaffPassword(adminUser: any, targetUserId: string, dto: ResetStaffPasswordDto) {
    const adminId = adminUser?.id || adminUser?.sub || 'SYSTEM';
    const adminRole = adminUser?.role || UserRole.SUPER_ADMIN;

    let targetUser = null;
    if (this.prisma && this.prisma.user) {
      targetUser = await this.prisma.user.findUnique({
        where: { id: targetUserId },
      });
    }

    if (!targetUser) {
      throw new NotFoundException('Staff account not found.');
    }

    if (adminRole === UserRole.FACILITY_ADMIN && targetUser.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Facility Administrators cannot reset passwords for System Administrators (SUPER_ADMIN).',
      );
    }

    if (!dto.newPassword || dto.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters long.');
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    const mustChangePassword = dto.mustChangePassword !== false;

    try {
      if (this.prisma && this.prisma.user) {
        await this.prisma.user.update({
          where: { id: targetUserId },
          data: {
            passwordHash,
            mustChangePassword,
            updatedAt: new Date(),
          },
        });

        // Sync with Supabase Auth
        if (SupabaseService.staticClient) {
          try {
            await SupabaseService.staticClient.auth.admin.updateUserById(targetUserId, {
              password: dto.newPassword,
            });
          } catch (authErr: any) {
            this.logger.warn(`Supabase Auth password update notice: ${authErr.message}`);
          }
        }

        // Record audit log (without password!)
        if ((this.prisma as any).auditLog) {
          await (this.prisma as any).auditLog.create({
            data: {
              userId: adminId,
              role: adminRole,
              action: 'STAFF_PASSWORD_RESET_BY_ADMIN',
              entityName: 'users',
              entityId: targetUserId,
              newValues: {
                targetEmail: targetUser.email,
                mustChangePassword,
                resetBy: adminId,
                timestamp: new Date().toISOString(),
              },
            },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Password reset failed: ${err.message}`);
      throw new BadRequestException('Failed to reset staff account password.');
    }

    return {
      success: true,
      message: `Password reset successfully for '${targetUser.fullName}'. Employee must change password on next sign-in.`,
    };
  }

  /**
   * Activates, suspends, or deactivates an employee account.
   */
  async updateStaffStatus(adminUser: any, targetUserId: string, dto: UpdateStaffStatusDto) {
    const adminId = adminUser?.id || adminUser?.sub || 'SYSTEM';
    const adminRole = adminUser?.role || UserRole.SUPER_ADMIN;

    if (targetUserId === adminId && dto.status !== 'ACTIVE') {
      throw new BadRequestException('Administrators cannot suspend or deactivate their own active account.');
    }

    let targetUser = null;
    if (this.prisma && this.prisma.user) {
      targetUser = await this.prisma.user.findUnique({
        where: { id: targetUserId },
      });
    }

    if (!targetUser) {
      throw new NotFoundException('Staff account not found.');
    }

    if (adminRole === UserRole.FACILITY_ADMIN && targetUser.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Facility Administrators cannot alter the operational status of System Administrators.',
      );
    }

    const isActive = dto.status === 'ACTIVE';
    const approvalStatus = isActive ? 'APPROVED' : dto.status;

    try {
      if (this.prisma && this.prisma.user) {
        await this.prisma.user.update({
          where: { id: targetUserId },
          data: {
            isActive,
            approvalStatus,
            updatedAt: new Date(),
          },
        });

        // Record audit event
        if ((this.prisma as any).auditLog) {
          await (this.prisma as any).auditLog.create({
            data: {
              userId: adminId,
              role: adminRole,
              action: 'STAFF_ACCOUNT_STATUS_CHANGED',
              entityName: 'users',
              entityId: targetUserId,
              newValues: {
                targetEmail: targetUser.email,
                newStatus: dto.status,
                isActive,
                reason: dto.reason || 'Status updated by administrator',
                changedBy: adminId,
                timestamp: new Date().toISOString(),
              },
            },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Status update failed: ${err.message}`);
      throw new BadRequestException('Failed to update account status.');
    }

    return {
      success: true,
      message: `Account status for '${targetUser.fullName}' set to ${dto.status}.`,
    };
  }

  /**
   * Audits clinical staff professional licences approaching expiry (within 90 days or expired)
   */
  async getExpiringLicences() {
    try {
      if (this.prisma && this.prisma.staffProfile) {
        const profiles = await this.prisma.staffProfile.findMany();
        const now = new Date();
        const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

        return profiles
          .filter((p: any) => p.licenseExpiryDate)
          .map((p: any) => {
            const exp = new Date(p.licenseExpiryDate);
            const daysRemaining = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return {
              staffName: p.jobTitle || 'Clinical Staff',
              licenceNumber: p.licenseNumber || '—',
              board: p.licenseBoard || 'Regulatory Board',
              expiryDate: p.licenseExpiryDate,
              daysRemaining,
              status: exp < now ? 'EXPIRED' : exp <= ninetyDaysOut ? 'EXPIRING_SOON' : 'VALID',
            };
          });
      }
    } catch (err) {
      this.logger.warn(`Staff licence audit fetch error: ${err}`);
    }
    return [];
  }
}
