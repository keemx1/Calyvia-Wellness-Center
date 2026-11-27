import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { SupabaseService } from '../../database/supabase.service';
import {
  LoginDto,
  RequestAccessDto,
  ChangePasswordDto,
  ApproveAccessDto,
  RejectAccessDto,
  UpdateUserStatusDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { UserRole } from '@calyvia/shared';

@Injectable()
export class SecurityService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  private jwtSecret(kind: 'access' | 'refresh'): string {
    const secret = kind === 'access' ? process.env.JWT_ACCESS_SECRET : process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`JWT_${kind.toUpperCase()}_SECRET must be configured in production`);
      }
      return `dev-only-${kind}-secret`;
    }
    return secret;
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Standard institutional credentials lookup in PostgreSQL public schema
    let user = null;
    try {
      if (this.prisma && this.prisma.user) {
        user = await this.prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { staffProfile: true },
        });
      }
    } catch (err) {
      // Never turn a database outage into a credential bypass. Authentication
      // can still proceed through Supabase Auth, but only if that succeeds.
      console.warn('Database user lookup failed; Supabase Auth will be tried');
    }

    if (user) {
      let isValid = await this.verifyPassword(user.passwordHash, password);
      if (!isValid && SupabaseService.staticClient) {
        try {
          const { data: authData, error: authErr } = await SupabaseService.staticClient.auth.signInWithPassword({
            email: email.toLowerCase(),
            password,
          });
          if (!authErr && authData?.user) {
            isValid = true;
            const newHash = await this.hashPassword(password);
            this.prisma.user.update({
              where: { id: user.id },
              data: { passwordHash: newHash, updatedAt: new Date() },
            }).catch(() => {});
          }
        } catch {}
      }

      if (!isValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Check account approval and activation status
      if (user.approvalStatus === 'PENDING') {
        throw new UnauthorizedException('Your account registration is pending administrator authorization.');
      }
      if (user.approvalStatus === 'REJECTED') {
        throw new UnauthorizedException('Your access request was reviewed and declined by the hospital administration.');
      }
      if (user.approvalStatus === 'SUSPENDED' || !user.isActive) {
        throw new UnauthorizedException('User account has been deactivated or suspended. Please contact the administrator.');
      }
    } else {
      // User not yet in public.users: Supabase Auth is the only trusted source.
      // No local/fake identity may be minted without a verified auth session.
      if (!SupabaseService.staticClient) {
        throw new UnauthorizedException('Invalid email or password');
      }

      let authData: any;
      try {
        const result = await SupabaseService.staticClient.auth.signInWithPassword({
          email: email.toLowerCase(),
          password,
        });
        if (!result.error && result.data?.user) authData = result.data;
      } catch {
        // Treated as failed authentication below.
      }

      if (!authData) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const authRole = authData.user.user_metadata?.role || authData.user.app_metadata?.role;
      const validRoles: string[] = Object.values(UserRole);
      if (!authRole || !validRoles.includes(authRole)) {
        throw new ForbiddenException('The authenticated account has no valid Calyvia role assignment.');
      }

      const authName =
        authData.user.user_metadata?.fullName ||
        authData.user.email?.split('@')[0] ||
        'Calyvia User';

      user = await this.prisma.user.create({
        data: {
          id: authData.user.id,
          email: email.toLowerCase(),
          passwordHash: await this.hashPassword(password),
          role: authRole,
          fullName: authName,
          isActive: true,
          approvalStatus: 'APPROVED',
          mustChangePassword: false,
        },
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtSecret('access'),
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.jwtSecret('refresh'),
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        mustChangePassword: !!user.mustChangePassword,
      },
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.jwtSecret('refresh'),
      });

      const newAccessToken = this.jwtService.sign(
        {
          sub: payload.sub,
          email: payload.email,
          fullName: payload.fullName,
          role: payload.role,
        },
        {
          secret: this.jwtSecret('access'),
          expiresIn: '15m',
        },
      );

      return {
        accessToken: newAccessToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async requestAccess(_dto: RequestAccessDto) {
    throw new ForbiddenException(
      'Self-service staff account registration has been disabled. All institutional staff accounts and credentials must be provisioned directly by an authorized Facility Administrator.',
    );
  }

  async getPendingRequests() {
    try {
      if (this.prisma && this.prisma.user) {
        const users = await this.prisma.user.findMany({
          where: { approvalStatus: 'PENDING' },
          include: { staffProfile: true },
          orderBy: { createdAt: 'desc' },
        });
        return users.map((u: any) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          phone: u.phone,
          role: u.role,
          requestedRole: u.requestedRole,
          approvalStatus: u.approvalStatus,
          createdAt: u.createdAt,
          staffProfile: u.staffProfile
            ? {
                department: u.staffProfile.department,
                jobTitle: u.staffProfile.jobTitle,
                licenseNumber: u.staffProfile.licenseNumber,
                licenseBoard: u.staffProfile.licenseBoard,
              }
            : null,
        }));
      }
    } catch (err: any) {
      console.warn('Could not fetch pending requests:', err.message);
    }
    return [];
  }

  async approveRequest(adminId: string, targetUserId: string, dto: ApproveAccessDto) {
    let targetUser = null;
    try {
      if (this.prisma && this.prisma.user) {
        targetUser = await this.prisma.user.findUnique({
          where: { id: targetUserId },
        });
      }
    } catch {}

    if (!targetUser) {
      throw new BadRequestException('Target employee account not found.');
    }

    const assignedRole = dto.assignedRole || targetUser.requestedRole || targetUser.role;

    // Disallow elevating to SUPER_ADMIN through approval workflow
    if (assignedRole === UserRole.SUPER_ADMIN && targetUser.role !== UserRole.SUPER_ADMIN) {
      throw new BadRequestException('SUPER_ADMIN privileges cannot be granted through employee approval workflow.');
    }

    try {
      if (this.prisma && this.prisma.user) {
        await this.prisma.user.update({
          where: { id: targetUserId },
          data: {
            approvalStatus: 'APPROVED',
            isActive: true,
            role: assignedRole,
            approvedBy: adminId,
            approvedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Record in audit log
        if ((this.prisma as any).auditLog) {
          await (this.prisma as any).auditLog.create({
            data: {
              userId: adminId,
              role: UserRole.SUPER_ADMIN,
              action: 'EMPLOYEE_ACCOUNT_APPROVED',
              entityName: 'users',
              entityId: targetUserId,
              newValues: {
                targetEmail: targetUser.email,
                approvedRole: assignedRole,
                approvedByAdmin: adminId,
                notes: dto.notes || 'Institutional authorization granted',
                approvedAt: new Date().toISOString(),
              },
            },
          });
        }
      }

      // Synchronize role to Supabase Auth if accessible
      if (SupabaseService.staticClient) {
        try {
          await SupabaseService.staticClient.auth.admin.updateUserById(targetUserId, {
            user_metadata: { role: assignedRole, approved: true },
            app_metadata: { role: assignedRole, approved: true },
          });
        } catch {}
      }
    } catch (err: any) {
      console.error('Failed to approve employee request:', err.message);
      throw new BadRequestException('Error approving employee request.');
    }

    return {
      success: true,
      message: `Employee account for ${targetUser.email} approved and activated with role ${assignedRole}.`,
    };
  }

  async rejectRequest(adminId: string, targetUserId: string, dto: RejectAccessDto) {
    let targetUser = null;
    try {
      if (this.prisma && this.prisma.user) {
        targetUser = await this.prisma.user.findUnique({
          where: { id: targetUserId },
        });
      }
    } catch {}

    if (!targetUser) {
      throw new BadRequestException('Target employee account not found.');
    }

    try {
      if (this.prisma && this.prisma.user) {
        await this.prisma.user.update({
          where: { id: targetUserId },
          data: {
            approvalStatus: 'REJECTED',
            isActive: false,
            rejectionReason: dto.reason,
            updatedAt: new Date(),
          },
        });

        if ((this.prisma as any).auditLog) {
          await (this.prisma as any).auditLog.create({
            data: {
              userId: adminId,
              role: UserRole.SUPER_ADMIN,
              action: 'EMPLOYEE_ACCOUNT_REJECTED',
              entityName: 'users',
              entityId: targetUserId,
              newValues: {
                targetEmail: targetUser.email,
                reason: dto.reason,
                rejectedAt: new Date().toISOString(),
              },
            },
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to reject employee request:', err.message);
      throw new BadRequestException('Error declining employee request.');
    }

    return {
      success: true,
      message: `Access request for ${targetUser.email} has been declined.`,
    };
  }

  async updateUserStatus(adminId: string, targetUserId: string, dto: UpdateUserStatusDto) {
    let targetUser = null;
    try {
      if (this.prisma && this.prisma.user) {
        targetUser = await this.prisma.user.findUnique({
          where: { id: targetUserId },
        });
      }
    } catch {}

    if (!targetUser) {
      throw new BadRequestException('Target user account not found.');
    }

    // Protect primary administrator account from demotion or deactivation
    if (targetUser.email === 'admin@calyviawellness.co.ke' && dto.status !== 'ACTIVE') {
      throw new BadRequestException('Primary system administrator account cannot be deactivated or suspended.');
    }

    const isActive = dto.status === 'ACTIVE';
    const approvalStatus = dto.status === 'ACTIVE' ? 'APPROVED' : (dto.status === 'SUSPENDED' ? 'SUSPENDED' : 'REJECTED');
    const updateData: any = {
      isActive,
      approvalStatus,
      updatedAt: new Date(),
    };
    if (dto.role) {
      if (dto.role === UserRole.SUPER_ADMIN && targetUser.role !== UserRole.SUPER_ADMIN) {
        throw new BadRequestException('SUPER_ADMIN role cannot be assigned through status update.');
      }
      updateData.role = dto.role;
    }

    try {
      if (this.prisma && this.prisma.user) {
        await this.prisma.user.update({
          where: { id: targetUserId },
          data: updateData,
        });

        if ((this.prisma as any).auditLog) {
          await (this.prisma as any).auditLog.create({
            data: {
              userId: adminId,
              role: UserRole.SUPER_ADMIN,
              action: 'USER_ACCOUNT_STATUS_UPDATED',
              entityName: 'users',
              entityId: targetUserId,
              newValues: {
                targetEmail: targetUser.email,
                newStatus: dto.status,
                newRole: dto.role || targetUser.role,
                reason: dto.reason,
                updatedAt: new Date().toISOString(),
              },
            },
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to update account status:', err.message);
      throw new BadRequestException('Error updating account status.');
    }

    return {
      success: true,
      message: `Account status for ${targetUser.email} updated to ${dto.status}.`,
    };
  }

  private mapDepartmentToRole(dept: string): UserRole {
    if (!dept) return UserRole.NURSE;
    const d = dept.toLowerCase();
    if (d.includes('psychiatry') || d.includes('doctor') || d.includes('clinical')) return UserRole.DOCTOR_PSYCHIATRIST;
    if (d.includes('nursing') || d.includes('detox')) return UserRole.NURSE;
    if (d.includes('counsell') || d.includes('psycholog')) return UserRole.COUNSELLOR;
    if (d.includes('pharmacy') || d.includes('dispensary')) return UserRole.PHARMACIST;
    if (d.includes('admission') || d.includes('front desk') || d.includes('reception')) return UserRole.ADMISSIONS_FRONT_DESK;
    if (d.includes('billing') || d.includes('finance') || d.includes('cashier')) return UserRole.FINANCE_BILLING;
    if (d.includes('inventory') || d.includes('store')) return UserRole.INVENTORY_STORE;
    if (d.includes('facility') || d.includes('admin')) return UserRole.FACILITY_ADMIN;
    return UserRole.NURSE;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const { currentPassword, newPassword } = dto;

    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters in length.');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current temporary password.');
    }

    let user = null;
    if (this.prisma && this.prisma.user) {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
    }

    if (!user) {
      throw new UnauthorizedException('User account not found.');
    }

    const isValid = await this.verifyPassword(user.passwordHash, currentPassword);
    if (!isValid) {
      throw new UnauthorizedException('Current password does not match.');
    }

    const newHash = await this.hashPassword(newPassword);

    if (this.prisma && this.prisma.user) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
          updatedAt: new Date(),
        },
      });

      // Synchronize new password with Supabase Auth if accessible
      if (SupabaseService.staticClient) {
        try {
          await SupabaseService.staticClient.auth.admin.updateUserById(userId, {
            password: newPassword,
          });
        } catch (supabaseErr) {
          console.warn('Supabase Auth password sync notification:', (supabaseErr as any).message);
        }
      }

      // Record in immutable audit log
      if ((this.prisma as any).auditLog) {
        await (this.prisma as any).auditLog.create({
          data: {
            userId: user.id,
            role: user.role,
            action: 'USER_PASSWORD_CHANGE',
            entityName: 'users',
            entityId: user.id,
            newValues: { changedAt: new Date().toISOString() },
          },
        });
      }
    }

    return {
      success: true,
      message: 'Password changed successfully. Permanent administrative credentials activated.',
    };
  }

  async logout(userId: string) {
    if (userId) {
      // Invalidate Supabase Auth session if accessible
      if (SupabaseService.staticClient) {
        try {
          await SupabaseService.staticClient.auth.admin.signOut(userId);
        } catch (signOutErr) {
          // Graceful handling for non-Supabase-managed tokens
        }
      }

      // Record logout audit log
      try {
        if (this.prisma && (this.prisma as any).auditLog) {
          await (this.prisma as any).auditLog.create({
            data: {
              userId,
              role: 'AUTHENTICATED',
              action: 'USER_LOGOUT',
              entityName: 'users',
              entityId: userId,
              newValues: { loggedOutAt: new Date().toISOString() },
            },
          });
        }
      } catch (err) {
        console.warn('Could not record logout audit log:', err);
      }
    }

    return {
      success: true,
      message: 'Logged out successfully. Authentication session invalidated.',
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const { fullName, phone, department, jobTitle } = dto;
    const userUpdateData: any = {};
    if (fullName !== undefined) userUpdateData.fullName = fullName.trim();
    if (phone !== undefined) userUpdateData.phone = phone.trim();

    let updatedUser: any = null;
    if (Object.keys(userUpdateData).length > 0 && this.prisma && this.prisma.user) {
      try {
        updatedUser = await this.prisma.user.update({
          where: { id: userId },
          data: userUpdateData,
        });
      } catch (err) {
        console.warn('Direct user table update note:', (err as any).message);
      }
    }

    // Update staff profile if department or jobTitle specified
    if ((department !== undefined || jobTitle !== undefined) && this.prisma && this.prisma.staffProfile) {
      try {
        const staffData: any = {};
        if (department !== undefined) staffData.department = department.trim();
        if (jobTitle !== undefined) staffData.jobTitle = jobTitle.trim();

        const existingProfile = await this.prisma.staffProfile.findUnique({
          where: { userId },
        });

        if (existingProfile) {
          await this.prisma.staffProfile.update({
            where: { userId },
            data: staffData,
          });
        }
      } catch (err) {
        console.warn('Staff profile update note:', (err as any).message);
      }
    }

    // Sync user metadata to Supabase Auth if applicable
    if (SupabaseService.staticClient && (fullName || department || jobTitle)) {
      try {
        await SupabaseService.staticClient.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...(fullName ? { fullName } : {}),
            ...(department ? { department } : {}),
            ...(jobTitle ? { jobTitle } : {}),
          },
        });
      } catch (supabaseErr) {
        console.warn('Supabase Auth user metadata update note:', (supabaseErr as any).message);
      }
    }

    // Record audit log entry
    try {
      if (this.prisma && (this.prisma as any).auditLog) {
        await (this.prisma as any).auditLog.create({
          data: {
            userId,
            role: 'AUTHENTICATED',
            action: 'USER_PROFILE_UPDATE',
            entityName: 'users',
            entityId: userId,
            newValues: { fullName, phone, department, jobTitle, updatedAt: new Date().toISOString() },
          },
        });
      }
    } catch {}

    return {
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: userId,
        fullName: updatedUser?.fullName || fullName,
        phone: updatedUser?.phone || phone,
        department,
        jobTitle,
      },
    };
  }
}
