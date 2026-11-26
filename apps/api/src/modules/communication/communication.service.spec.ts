import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { PrismaService } from '../../database/prisma.service';
import { SystemSettingsService } from '../system-admin/settings.service';
import { CommunicationChannel } from '@calyvia/shared';

/**
 * Regression coverage for the `communication_logs` schema mapping.
 *
 * The table uses recipient_phone / message_type / message_body / provider_message_id /
 * delivery_status / recipient_type. An earlier version of this service wrote
 * `recipient`, `channel`, `subject`, `body`, `status`, `providerRef`, which matched NO
 * column, so every insert failed and the table stayed empty.
 */

/** Mirrors SystemSettingsService: deployment env wins, then system_settings. */
function makeSettings(db: Record<string, string> = {}) {
  return {
    get: jest.fn(async (envVar: string, settingKey: string) =>
      process.env[envVar]?.trim() || db[settingKey] || undefined,
    ),
    require: jest.fn(async (envVar: string, settingKey: string) => {
      const v = process.env[envVar]?.trim() || db[settingKey];
      if (!v) throw new Error(`missing ${envVar}`);
      return v;
    }),
    readSetting: jest.fn(async (k: string) => db[k] ?? null),
    set: jest.fn(),
    listGatewaySettings: jest.fn(),
    saveGatewaySettings: jest.fn(),
  };
}

describe('CommunicationService (SMS & WhatsApp dispatch)', () => {
  let service: CommunicationService;
  let mockPrisma: any;
  let mockSettings: ReturnType<typeof makeSettings>;

  beforeEach(async () => {
    mockPrisma = {
      communicationLog: {
        create: jest.fn().mockImplementation((args: any) =>
          Promise.resolve({ id: 'comm-test-1', ...args.data }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    mockSettings = makeSettings();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunicationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SystemSettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get<CommunicationService>(CommunicationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('renders a saved message format instead of dispatching a raw body', async () => {
    await service.sendMessage({
      recipient: '0712345678',
      channel: CommunicationChannel.SMS,
      templateKey: 'APPOINTMENT_REMINDER',
      variables: {
        patient_name: 'Hannah',
        facility: 'Calyvia Wellness Center',
        appointment_date: '27 Nov at 10:00 AM',
        phone: '+254700534306',
      },
      body: 'this must be ignored when a template is selected',
    });

    const data = mockPrisma.communicationLog.create.mock.calls[0][0].data;
    expect(data.messageBody).toContain('Hannah');
    expect(data.messageBody).toContain('27 Nov at 10:00 AM');
    expect(data.messageBody).not.toContain('{{');
    expect(data.messageBody).not.toContain('this must be ignored');
  });

  it('rejects a template with missing variables before any dispatch', async () => {
    await expect(
      service.sendMessage({
        recipient: '0712345678',
        channel: CommunicationChannel.SMS,
        templateKey: 'APPOINTMENT_REMINDER',
        variables: { patient_name: 'Hannah' },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.communicationLog.create).not.toHaveBeenCalled();
  });

  describe('schema mapping (regression)', () => {
    it('persists using the real column names of communication_logs', async () => {
      await service.sendMessage({
        recipient: '0712345678',
        channel: CommunicationChannel.SMS,
        body: 'Your appointment is tomorrow at 10:00.',
      });

      expect(mockPrisma.communicationLog.create).toHaveBeenCalledTimes(1);
      const data = mockPrisma.communicationLog.create.mock.calls[0][0].data;

      // Exactly the live columns - no phantom fields like `recipient`, `channel`, `subject`.
      expect(Object.keys(data).sort()).toEqual(
        [
          'costKes',
          'deliveryStatus',
          'messageBody',
          'messageType',
          'provider',
          'providerMessageId',
          'recipientPhone',
          'recipientType',
          'sentAt',
        ].sort(),
      );

      expect(data.recipientPhone).toBe('+254712345678');
      expect(data.messageType).toBe('SMS');
      expect(data.messageBody).toBe('Your appointment is tomorrow at 10:00.');
      expect(data.recipientType).toBe('PATIENT');
      expect(data.deliveryStatus).toBe('SENT');
    });

    it('never writes the undefined legacy columns', async () => {
      await service.sendMessage({
        recipient: '0712345678',
        channel: CommunicationChannel.SMS,
        subject: 'Reminder',
        body: 'Hello',
      });

      const data = mockPrisma.communicationLog.create.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('recipient');
      expect(data).not.toHaveProperty('channel');
      expect(data).not.toHaveProperty('subject');
      expect(data).not.toHaveProperty('body');
      expect(data).not.toHaveProperty('status');
      expect(data).not.toHaveProperty('providerRef');
    });

    it('normalizes Kenyan phone numbers to E.164', async () => {
      const cases: Array<[string, string]> = [
        ['0712345678', '+254712345678'],
        ['712345678', '+254712345678'],
        ['+254712345678', '+254712345678'],
        ['254712345678', '+254712345678'],
      ];

      for (const [input, expected] of cases) {
        jest.clearAllMocks();
        await service.sendMessage({
          recipient: input,
          channel: CommunicationChannel.SMS,
          body: 'test',
        });
        expect(mockPrisma.communicationLog.create.mock.calls[0][0].data.recipientPhone).toBe(expected);
      }
    });
  });

  describe('channel dispatch', () => {
    it('routes SMS through the SMS provider and records its message id', async () => {
      const result = await service.sendMessage({
        recipient: '0712345678',
        channel: CommunicationChannel.SMS,
        body: 'Reminder',
      });

      const data = mockPrisma.communicationLog.create.mock.calls[0][0].data;
      expect(data.provider).toBe('MOCK');
      expect(data.providerMessageId).toEqual(expect.stringContaining('MOCK-SMS-'));
      expect(result.providerRef).toEqual(expect.stringContaining('MOCK-SMS-'));
    });

    it('routes WhatsApp through the WhatsApp provider at zero cost', async () => {
      await service.sendMessage({
        recipient: '0712345678',
        channel: CommunicationChannel.WHATSAPP,
        body: 'Reminder',
      });

      const data = mockPrisma.communicationLog.create.mock.calls[0][0].data;
      expect(data.messageType).toBe('WHATSAPP');
      // WhatsApp is free; a 0 cost must not be replaced by the DB default of 1.00.
      expect(data.costKes).toBe(0);
    });

    it('rejects EMAIL until a mail provider exists', async () => {
      await expect(
        service.sendMessage({
          recipient: 'someone@example.com',
          channel: CommunicationChannel.EMAIL,
          body: 'Hello',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.communicationLog.create).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('rejects an empty body', async () => {
      await expect(
        service.sendMessage({ recipient: '0712345678', channel: CommunicationChannel.SMS, body: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a missing recipient', async () => {
      await expect(
        service.sendMessage({ recipient: '', channel: CommunicationChannel.SMS, body: 'Hello' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a malformed phone number', async () => {
      await expect(
        service.sendMessage({ recipient: '123', channel: CommunicationChannel.SMS, body: 'Hello' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.communicationLog.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown channel', async () => {
      await expect(
        service.sendMessage({ recipient: '0712345678', channel: 'CARRIER_PIGEON' as any, body: 'Hello' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('log read path', () => {
    it('translates DB columns into the shape the admin UI renders', async () => {
      mockPrisma.communicationLog.findMany.mockResolvedValue([
        {
          id: 'row-1',
          recipientPhone: '+254712345678',
          messageType: 'SMS',
          messageBody: 'Hello there',
          providerMessageId: 'ATXid_123',
          deliveryStatus: 'SENT',
          provider: 'BYTEWAVE',
          sentAt: new Date('2026-11-19T10:00:00Z'),
          costKes: 0.25,
        },
      ]);

      const logs = await service.getRecentLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        id: 'row-1',
        recipient: '+254712345678',
        channel: 'SMS',
        body: 'Hello there',
        providerRef: 'ATXid_123',
        status: 'SENT',
        provider: 'BYTEWAVE',
        costKes: 0.25,
      });
    });

    it('returns an empty list instead of throwing when the DB is unavailable', async () => {
      mockPrisma.communicationLog.findMany.mockRejectedValue(new Error('connection refused'));
      await expect(service.getRecentLogs()).resolves.toEqual([]);
    });
  });

  describe('driver failure handling', () => {
    const ORIGINAL_SMS_PROVIDER = process.env.SMS_PROVIDER;

    afterEach(() => {
      if (ORIGINAL_SMS_PROVIDER === undefined) delete process.env.SMS_PROVIDER;
      else process.env.SMS_PROVIDER = ORIGINAL_SMS_PROVIDER;
    });

    it('stays bootable and reports a FAILED dispatch when a driver cannot be constructed', async () => {
      // A misconfigured gateway must not take the whole API down.
      delete process.env.SMS_PROVIDER;
      delete process.env.BYTEWAVE_API_URL;
      delete process.env.BYTEWAVE_API_KEY;

      mockSettings = makeSettings({
        'gateway.sms.provider': 'bytewave',
        // deliberately no api_url / api_key
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunicationService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: SystemSettingsService, useValue: mockSettings },
        ],
      }).compile();

      const localService = module.get<CommunicationService>(CommunicationService);
      expect(localService).toBeDefined();

      await expect(
        localService.sendMessage({
          recipient: '0712345678',
          channel: CommunicationChannel.SMS,
          body: 'Hello',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      // The attempt is still recorded so there is an audit trail of the failure.
      const data = mockPrisma.communicationLog.create.mock.calls[0][0].data;
      expect(data.deliveryStatus).toBe('FAILED');
      expect(data.provider).toBe('BYTEWAVE');
      expect(data.providerMessageId).toBeNull();
    });
  });

  /**
   * The hybrid config contract: system_settings is the operator-editable fallback,
   * and the deployment environment always wins.
   */
  describe('gateway configuration resolution', () => {
    const ENV_KEYS = ['SMS_PROVIDER', 'AFRICASTALKING_USERNAME', 'AFRICASTALKING_API_KEY'] as const;
    const saved: Record<string, string | undefined> = {};

    beforeEach(() => {
      for (const k of ENV_KEYS) {
        saved[k] = process.env[k];
        delete process.env[k];
      }
    });

    afterEach(() => {
      for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k]!;
      }
    });

    it('dispatches using credentials stored in system_settings when the environment is empty', async () => {
      const atResponse = {
        SMSMessageData: {
          Message: 'Sent to 1/1 Total Cost: KES 0.8000 Message parts: 1',
          Recipients: [
            {
              statusCode: 100,
              number: '+254712345678',
              status: 'Success',
              cost: 'KES 0.8000',
              messageId: 'ATXid_999',
            },
          ],
        },
      };

      const fetchSpy = jest
        .spyOn(globalThis, 'fetch' as any)
        .mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(atResponse),
        } as any);

      mockSettings = makeSettings({
        'gateway.sms.provider': 'africas_talking',
        'gateway.sms.africastalking.username': 'calyvia',
        'gateway.sms.africastalking.api_key': 'db-stored-secret',
        'gateway.sms.africastalking.sender_id': 'CALYVIA',
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunicationService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: SystemSettingsService, useValue: mockSettings },
        ],
      }).compile();

      const localService = module.get<CommunicationService>(CommunicationService);

      await localService.sendMessage({
        recipient: '0712345678',
        channel: CommunicationChannel.SMS,
        body: 'Reminder from system_settings config',
      });

      // The DB-configured driver really ran.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0] as any[];
      expect(String(url)).toContain('/version1/messaging');
      expect((init.headers as any).apiKey).toBe('db-stored-secret');

      const data = mockPrisma.communicationLog.create.mock.calls[0][0].data;
      expect(data.provider).toBe('AFRICAS_TALKING');
      expect(data.providerMessageId).toBe('ATXid_999');
      expect(data.costKes).toBe(0.8);
      expect(data.deliveryStatus).toBe('SENT');
    });

    it('lets an environment variable override system_settings', async () => {
      process.env.SMS_PROVIDER = 'mock';

      const fetchSpy = jest.spyOn(globalThis, 'fetch' as any);

      mockSettings = makeSettings({ 'gateway.sms.provider': 'bytewave' });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunicationService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: SystemSettingsService, useValue: mockSettings },
        ],
      }).compile();

      const localService = module.get<CommunicationService>(CommunicationService);

      await localService.sendMessage({
        recipient: '0712345678',
        channel: CommunicationChannel.SMS,
        body: 'env wins',
      });

      // mock won over the DB's "bytewave", so no HTTP call and a MOCK ref.
      expect(fetchSpy).not.toHaveBeenCalled();
      const data = mockPrisma.communicationLog.create.mock.calls[0][0].data;
      expect(data.provider).toBe('MOCK');
    });
  });
});
