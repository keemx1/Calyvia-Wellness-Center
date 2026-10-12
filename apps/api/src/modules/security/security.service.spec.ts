import { Test, TestingModule } from '@nestjs/testing';
import { SecurityService } from './security.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { UserRole, canAccessModule, hasPermission, Permission } from '@calyvia/shared';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';

describe('SecurityService (Authentication & Password Security)', () => {
  let service: SecurityService;
  let mockPrisma: any;
  let mockJwtService: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'mock-user-001', email: 'jane.muthoni@calyviawellness.co.ke' }),
        update: jest.fn().mockResolvedValue({ id: 'mock-user-001' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      staffProfile: {
        create: jest.fn().mockResolvedValue({ id: 'mock-profile-001' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'mock-audit-001' }),
      },
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('jwt-mock-token-sample'),
      signAsync: jest.fn().mockResolvedValue('jwt-mock-token-sample'),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should hash and verify passwords using Argon2id', async () => {
    const rawPassword = 'ClinicalSecure#2026';
    const hash = await service.hashPassword(rawPassword);

    expect(hash).toBeDefined();
    expect(hash).toContain('$argon2');

    const isValid = await service.verifyPassword(hash, rawPassword);
    expect(isValid).toBe(true);

    const isInvalid = await service.verifyPassword(hash, 'WrongPassword');
    expect(isInvalid).toBe(false);
  }, 15000);

  it('should authenticate bootstrap admin credentials when database is uninitialized', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await service.login({
      email: 'admin@calyviawellness.co.ke',
      password: 'Calyvia#2026',
    });

    expect(res).toBeDefined();
    expect(res.user.role).toBe(UserRole.SUPER_ADMIN);
    expect(res.tokens.accessToken).toBe('jwt-mock-token-sample');
  });

  it('should reject invalid credentials with UnauthorizedException', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'unknown@calyviawellness.co.ke',
        password: 'BadPassword',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject deactivated user accounts even with valid credentials', async () => {
    const rawPassword = 'ClinicalSecure#2026';
    const hash = await service.hashPassword(rawPassword);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'usr-deactivated-001',
      email: 'former.staff@calyviawellness.co.ke',
      passwordHash: hash,
      role: UserRole.NURSE,
      fullName: 'Former Staff Member',
      isActive: false, // Deactivated
    });

    await expect(
      service.login({
        email: 'former.staff@calyviawellness.co.ke',
        password: rawPassword,
      }),
    ).rejects.toThrow('User account has been deactivated');
  });

  it('should reject self-service access request with ForbiddenException (public registration disabled)', async () => {
    await expect(
      service.requestAccess({
        fullName: 'Jane Muthoni',
        email: 'jane.muthoni@calyviawellness.co.ke',
        phone: '+254712345678',
        department: 'Clinical Operations',
        jobTitle: 'Resident Medical Officer',
        justification: 'New clinical shift rotation in detox ward',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  describe('Institutional Role-Based Access Control (RBAC) Module Boundaries', () => {

    it('should strictly limit Cashier (FINANCE_BILLING) to billing/finance and block clinical & admin', () => {
      // Cashier permitted modules
      expect(canAccessModule(UserRole.FINANCE_BILLING, 'billing')).toBe(true);
      expect(canAccessModule(UserRole.FINANCE_BILLING, 'reports')).toBe(true);
      expect(canAccessModule(UserRole.FINANCE_BILLING, 'tasks')).toBe(true);

      // Cashier strictly prohibited modules
      expect(canAccessModule(UserRole.FINANCE_BILLING, 'clinical')).toBe(false);
      expect(canAccessModule(UserRole.FINANCE_BILLING, 'detox')).toBe(false);
      expect(canAccessModule(UserRole.FINANCE_BILLING, 'counselling')).toBe(false);
      expect(canAccessModule(UserRole.FINANCE_BILLING, 'pharmacy')).toBe(false);
      expect(canAccessModule(UserRole.FINANCE_BILLING, 'system_admin')).toBe(false);
      expect(canAccessModule(UserRole.FINANCE_BILLING, 'security')).toBe(false);

      // Cashier permissions
      expect(hasPermission(UserRole.FINANCE_BILLING, Permission.BILLING_VIEW)).toBe(true);
      expect(hasPermission(UserRole.FINANCE_BILLING, Permission.CLINICAL_RECORDS_VIEW)).toBe(false);
      expect(hasPermission(UserRole.FINANCE_BILLING, Permission.SYSTEM_SETTINGS_MANAGE)).toBe(false);
    });

    it('should restrict Receptionist (ADMISSIONS_FRONT_DESK) from clinical records and billing admin', () => {
      expect(canAccessModule(UserRole.ADMISSIONS_FRONT_DESK, 'patients')).toBe(true);
      expect(canAccessModule(UserRole.ADMISSIONS_FRONT_DESK, 'appointments')).toBe(true);
      expect(canAccessModule(UserRole.ADMISSIONS_FRONT_DESK, 'crm')).toBe(true);

      expect(canAccessModule(UserRole.ADMISSIONS_FRONT_DESK, 'clinical')).toBe(false);
      expect(canAccessModule(UserRole.ADMISSIONS_FRONT_DESK, 'billing')).toBe(false);
      expect(canAccessModule(UserRole.ADMISSIONS_FRONT_DESK, 'system_admin')).toBe(false);
    });

    it('should grant Doctor (DOCTOR_PSYCHIATRIST) clinical records and block system admin', () => {
      expect(canAccessModule(UserRole.DOCTOR_PSYCHIATRIST, 'clinical')).toBe(true);
      expect(canAccessModule(UserRole.DOCTOR_PSYCHIATRIST, 'detox')).toBe(true);
      expect(canAccessModule(UserRole.DOCTOR_PSYCHIATRIST, 'counselling')).toBe(true);

      expect(canAccessModule(UserRole.DOCTOR_PSYCHIATRIST, 'billing')).toBe(false);
      expect(canAccessModule(UserRole.DOCTOR_PSYCHIATRIST, 'system_admin')).toBe(false);
    });

    it('should grant Nurse (NURSE) clinical/vitals and block financial administration', () => {
      expect(canAccessModule(UserRole.NURSE, 'clinical')).toBe(true);
      expect(canAccessModule(UserRole.NURSE, 'detox')).toBe(true);
      expect(canAccessModule(UserRole.NURSE, 'pharmacy')).toBe(true);

      expect(canAccessModule(UserRole.NURSE, 'billing')).toBe(false);
      expect(canAccessModule(UserRole.NURSE, 'system_admin')).toBe(false);
    });

    it('should grant Super Admin (SUPER_ADMIN) universal system administration and audit access', () => {
      expect(canAccessModule(UserRole.SUPER_ADMIN, 'dashboard')).toBe(true);
      expect(canAccessModule(UserRole.SUPER_ADMIN, 'system_admin')).toBe(true);
      expect(canAccessModule(UserRole.SUPER_ADMIN, 'security')).toBe(true);
      expect(canAccessModule(UserRole.SUPER_ADMIN, 'billing')).toBe(true);
      expect(canAccessModule(UserRole.SUPER_ADMIN, 'clinical')).toBe(true);
    });
  });
});
