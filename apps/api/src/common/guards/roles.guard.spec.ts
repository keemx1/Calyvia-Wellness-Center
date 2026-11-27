import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '@calyvia/shared';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('RolesGuard (RBAC least privilege)', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (userRole?: UserRole): ExecutionContext => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: userRole ? { role: userRole } : null,
        }),
      }),
    } as any;
  };

  it('should deny access when no role policy is declared (fail closed)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext(UserRole.NURSE);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow SUPER_ADMIN full access regardless of required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.FINANCE_BILLING]);
    const context = createMockContext(UserRole.SUPER_ADMIN);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow user if their role is in required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.NURSE, UserRole.DOCTOR_PSYCHIATRIST]);
    const context = createMockContext(UserRole.NURSE);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException if user lacks required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.FINANCE_BILLING]);
    const context = createMockContext(UserRole.COUNSELLOR);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
