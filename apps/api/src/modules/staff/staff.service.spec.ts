import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@calyvia/shared';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('StaffService (Admin-Controlled Staff Management)', () => {
  let service: StaffService;
  let mockPrisma: any;

  const mockAdminUser = {
    id: 'admin-uuid-001',
    email: 'admin@calyviawellness.co.ke',
    role: UserRole.FACILITY_ADMIN,
    fullName: 'Dr. Antony Baraka',
  };

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'usr-new-001', ...args.data })),
        update: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.where.id, ...args.data })),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'usr-001',
            email: 'nurse.beatrice@calyviawellness.co.ke',
            fullName: 'Beatrice Wanjiku',
            role: UserRole.NURSE,
            phone: '+254711000111',
            isActive: true,
            approvalStatus: 'APPROVED',
            mustChangePassword: false,
            createdAt: new Date(),
            staffProfile: {
              department: 'Inpatient Nursing',
              jobTitle: 'Senior Ward Nurse',
              licenseNumber: 'NCK/RN/1029',
              licenseBoard: 'Nursing Council of Kenya',
            },
          },
        ]),
      },
      staffProfile: {
        create: jest.fn().mockResolvedValue({ id: 'profile-001' }),
        update: jest.fn().mockResolvedValue({ id: 'profile-001' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-001' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should list staff accounts with search and department filtering', async () => {
    const all = await service.getStaffAccounts();
    expect(all).toHaveLength(1);
    expect(all[0].email).toBe('nurse.beatrice@calyviawellness.co.ke');

    const searchMatch = await service.getStaffAccounts({ search: 'Beatrice' });
    expect(searchMatch).toHaveLength(1);

    const searchMismatch = await service.getStaffAccounts({ search: 'NonExistent' });
    expect(searchMismatch).toHaveLength(0);
  });

  it('should allow Facility Administrator to provision a new staff account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await service.createStaffAccount(mockAdminUser, {
      fullName: 'Dr. Faith Mwangi',
      email: 'dr.faith@calyviawellness.co.ke',
      phone: '+254722000111',
      department: 'Clinical Operations',
      jobTitle: 'Consultant Psychiatrist',
      role: UserRole.DOCTOR_PSYCHIATRIST,
      initialPassword: 'ClinicalSecure#2026',
      status: 'ACTIVE',
      mustChangePassword: true,
    });

    expect(res.success).toBe(true);
    expect(res.user.email).toBe('dr.faith@calyviawellness.co.ke');
    expect(res.user.role).toBe(UserRole.DOCTOR_PSYCHIATRIST);
    expect(mockPrisma.user.create).toHaveBeenCalled();
    expect(mockPrisma.staffProfile.create).toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('should prevent Facility Administrator from escalating privileges to SUPER_ADMIN', async () => {
    await expect(
      service.createStaffAccount(mockAdminUser, {
        fullName: 'Rogue Admin',
        email: 'rogue@calyviawellness.co.ke',
        department: 'Administration',
        jobTitle: 'Super Admin Access',
        role: UserRole.SUPER_ADMIN,
        initialPassword: 'Password#2026',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should reject duplicate email during staff creation', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-id', email: 'existing@calyviawellness.co.ke' });

    await expect(
      service.createStaffAccount(mockAdminUser, {
        fullName: 'Duplicate User',
        email: 'existing@calyviawellness.co.ke',
        department: 'Clinical Operations',
        jobTitle: 'Nurse',
        role: UserRole.NURSE,
        initialPassword: 'Password#2026',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject initial password shorter than 8 characters', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.createStaffAccount(mockAdminUser, {
        fullName: 'Short Pwd User',
        email: 'short@calyviawellness.co.ke',
        department: 'Nursing',
        jobTitle: 'Nurse',
        role: UserRole.NURSE,
        initialPassword: '123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should allow administrator to update employee details and role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'target-001',
      email: 'target@calyviawellness.co.ke',
      fullName: 'Old Name',
      role: UserRole.NURSE,
      staffProfile: { department: 'Inpatient' },
    });

    const res = await service.updateStaffAccount(mockAdminUser, 'target-001', {
      fullName: 'Updated Name',
      role: UserRole.COUNSELLOR,
      department: 'Psychological Therapy',
      jobTitle: 'Lead Counsellor',
    });

    expect(res.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-001' },
        data: expect.objectContaining({ fullName: 'Updated Name', role: UserRole.COUNSELLOR }),
      }),
    );
  });

  it('should prevent administrator from modifying their own role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: mockAdminUser.id,
      email: mockAdminUser.email,
      role: UserRole.FACILITY_ADMIN,
    });

    await expect(
      service.updateStaffAccount(mockAdminUser, mockAdminUser.id, {
        role: UserRole.SUPER_ADMIN,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow administrator to reset staff password with temporary password flag', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'target-001',
      email: 'target@calyviawellness.co.ke',
      fullName: 'Target Staff',
      role: UserRole.NURSE,
    });

    const res = await service.resetStaffPassword(mockAdminUser, 'target-001', {
      newPassword: 'BrandNewPassword#2026',
      mustChangePassword: true,
    });

    expect(res.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-001' },
        data: expect.objectContaining({ mustChangePassword: true }),
      }),
    );
  });

  it('should allow administrator to suspend and activate staff account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'target-001',
      email: 'target@calyviawellness.co.ke',
      fullName: 'Target Staff',
      role: UserRole.NURSE,
      isActive: true,
    });

    const res = await service.updateStaffStatus(mockAdminUser, 'target-001', {
      status: 'SUSPENDED',
      reason: 'Administrative review',
    });

    expect(res.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-001' },
        data: expect.objectContaining({ isActive: false, approvalStatus: 'SUSPENDED' }),
      }),
    );
  });

  it('should prevent administrator from deactivating their own account', async () => {
    await expect(
      service.updateStaffStatus(mockAdminUser, mockAdminUser.id, {
        status: 'DEACTIVATED',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
