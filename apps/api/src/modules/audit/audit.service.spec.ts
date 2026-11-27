import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    service = new AuditService(mockPrisma);
  });

  it('clamps the requested limit to the supported maximum', async () => {
    await service.getAuditLogs({ limit: 500 });

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200, orderBy: { timestamp: 'desc' } }),
    );
  });

  it('returns who, what, when and the specific account for each event', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        userId: '11111111-1111-4111-8111-111111111111',
        role: 'FACILITY_ADMIN',
        action: 'STAFF_ACCOUNT_CREATED',
        resource: 'STAFF',
        resourceId: '22222222-2222-4222-8222-222222222222',
        ipAddress: '203.0.113.10',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date('2026-11-27T09:30:00.000Z'),
        newValues: { targetEmail: 'new.nurse@calyviawellness.co.ke' },
      },
    ]);
    mockPrisma.query.mockResolvedValue({
      rows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'admin@calyviawellness.co.ke',
          full_name: 'Calyvia Administrator',
          role: 'FACILITY_ADMIN',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          email: 'new.nurse@calyviawellness.co.ke',
          full_name: 'New Nurse',
          role: 'NURSE',
        },
      ],
    });

    const [event] = await service.getAuditLogs();

    expect(event.actor).toMatchObject({ email: 'admin@calyviawellness.co.ke' });
    expect(event.targetAccount).toMatchObject({ email: 'new.nurse@calyviawellness.co.ke' });
    expect(event.description).toContain('Created staff account');
    expect(event.severity).toBe('success');
    expect(event.context).toEqual({ targetEmail: 'new.nurse@calyviawellness.co.ke' });
  });

  it('keeps the attempted account visible for failed sign-ins without a known user', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-2',
        userId: null,
        role: 'ANONYMOUS',
        action: 'LOGIN_FAILED',
        resource: 'AUTH',
        resourceId: 'unknown@calyviawellness.co.ke',
        ipAddress: '198.51.100.4',
        timestamp: new Date('2026-11-27T10:00:00.000Z'),
      },
    ]);

    const [event] = await service.getAuditLogs();

    expect(event.targetAccount).toBeNull();
    expect(event.resourceId).toBe('unknown@calyviawellness.co.ke');
    expect(event.severity).toBe('attention');
    expect(event.description).toContain('Failed staff sign-in');
  });

  it('redacts secrets from audit metadata before returning it', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-3',
        action: 'USER_PROFILE_UPDATE',
        resource: 'users',
        newValues: { passwordHash: '$argon2id$secret', fullName: 'Jane Muthoni' },
        oldValues: { accessToken: 'jwt-value', role: 'NURSE' },
      },
    ]);

    const [event] = await service.getAuditLogs();

    expect(event.context.passwordHash).toBe('[REDACTED]');
    expect(event.newValues.passwordHash).toBe('[REDACTED]');
    expect(event.oldValues.accessToken).toBe('[REDACTED]');
    expect(event.context.fullName).toBe('Jane Muthoni');
  });

  it('writes audit metadata into the existing new_values column', async () => {
    await service.logAction({
      action: 'UPDATE_SYSTEM_SETTING',
      resource: 'SYSTEM_SETTING',
      diffJson: { setting: 'SMS_PROVIDER' },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ newValues: { setting: 'SMS_PROVIDER' } }),
    });
  });
});
