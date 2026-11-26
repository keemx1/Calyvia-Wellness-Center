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
          providerMessageId: 'BW-123',
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
        providerRef: 'BW-123',
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
    const ENV_KEYS = [
      'SMS_PROVIDER',
      'BYTEWAVE_API_MODE',
      'BYTEWAVE_API_URL',
      'BYTEWAVE_API_KEY',
      'BYTEWAVE_CLIENT_ID',
      'BYTEWAVE_CLIENT_SECRET',
      'BYTEWAVE_SENDER_ID',
      'BYTEWAVE_KEY_PARAM',
      'BYTEWAVE_PARAM_TO',
      'BYTEWAVE_PARAM_MESSAGE',
      'BYTEWAVE_PARAM_SENDER',
      'BYTEWAVE_ID_FIELD',
    ] as const;
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

    it('dispatches using ByteWave credentials stored in system_settings when the environment is empty', async () => {
      const fetchSpy = jest
        .spyOn(globalThis, 'fetch' as any)
        .mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: 'BW-999', status: 'sent' }),
        } as any);

      mockSettings = makeSettings({
        'gateway.sms.provider': 'bytewave',
        'gateway.sms.bytewave.api_url': 'https://portal.bytewavenetworks.com/api/http/',
        'gateway.sms.bytewave.api_key': 'db-stored-key',
        'gateway.sms.bytewave.sender_id': 'CALYVIA',
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

      // The DB-configured driver really ran, with no environment override.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0] as any[];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.pathname).toBe('/api/http/sms/send');
      expect(parsedUrl.searchParams.get('api_token')).toBe('db-stored-key');
      expect(parsedUrl.searchParams.get('recipient')).toBe('254712345678');
      expect(parsedUrl.searchParams.get('sender')).toBe('CALYVIA');
      expect((init as any).method).toBe('GET');

      const data = mockPrisma.communicationLog.create.mock.calls[0][0].data;
      expect(data.provider).toBe('BYTEWAVE');
      expect(data.providerMessageId).toBe('BW-999');
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

    it('ignores a stale SMS_PROVIDER=mock in production and dispatches via ByteWave', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.SMS_PROVIDER = 'mock';

      const fetchSpy = jest
        .spyOn(globalThis, 'fetch' as any)
        .mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: 'BW-PROD-1' }),
        } as any);

      mockSettings = makeSettings({
        'gateway.sms.provider': 'bytewave',
        'gateway.sms.bytewave.api_key': 'prod-key',
        'gateway.sms.bytewave.api_url': 'https://portal.bytewavenetworks.com/api/http/',
      });
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunicationService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: SystemSettingsService, useValue: mockSettings },
        ],
      }).compile();
      const localService = module.get<CommunicationService>(CommunicationService);

      try {
        await localService.sendMessage({
          recipient: '0703377395',
          channel: CommunicationChannel.SMS,
          body: 'Production must not use the mock driver',
        });

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const data = mockPrisma.communicationLog.create.mock.calls[0][0].data;
        expect(data.provider).toBe('BYTEWAVE');
        expect(data.deliveryStatus).toBe('SENT');
      } finally {
        if (originalEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalEnv;
      }
    });

    it('tests the saved ByteWave key even when SMS_PROVIDER=mock and api_url is invalid', async () => {
      process.env.SMS_PROVIDER = 'mock';
      const fetchSpy = jest
        .spyOn(globalThis, 'fetch' as any)
        .mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: 'BW-TEST-1' }),
        } as any);

      mockSettings = makeSettings({
        'gateway.sms.bytewave.api_key': 'saved-test-key',
        // A real misconfiguration seen in production: someone saved an email here.
        'gateway.sms.bytewave.api_url': 'someone@example.com',
        'gateway.sms.bytewave.sender_id': 'BytwaveSMS',
      });
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunicationService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: SystemSettingsService, useValue: mockSettings },
        ],
      }).compile();
      const localService = module.get<CommunicationService>(CommunicationService);

      const result = await localService.testByteWaveSms('0703377395');

      expect(result).toMatchObject({
        success: true,
        status: 'SENT',
        recipient: '+254703377395',
        endpoint: 'https://portal.bytewavenetworks.com/api/http/',
        endpointCorrected: true,
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const url = new URL(String(fetchSpy.mock.calls[0][0]));
      expect(url.pathname).toBe('/api/http/sms/send');
      expect(url.searchParams.get('api_token')).toBe('saved-test-key');
      expect(url.searchParams.get('recipient')).toBe('254703377395');
      // Secrets are never echoed back to the caller.
      expect(JSON.stringify(result)).not.toContain('saved-test-key');
    });

    it('refuses to claim success when no saved key exists', async () => {
      await expect(service.testByteWaveSms('0703377395')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('reads the ByteWave balance with the saved key without echoing it', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ status: 'success', data: { balance: 'KES 150.25', sms_balance: '600' } }),
      } as any);

      mockSettings = makeSettings({
        'gateway.sms.bytewave.api_key': 'saved-balance-key',
        'gateway.sms.bytewave.api_url': 'https://portal.bytewavenetworks.com/api/http/',
      });
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunicationService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: SystemSettingsService, useValue: mockSettings },
        ],
      }).compile();
      const localService = module.get<CommunicationService>(CommunicationService);

      const result = await localService.getByteWaveBalance();

      expect(result).toMatchObject({
        success: true,
        mode: 'http',
        balanceKes: 150.25,
        smsAvailable: 600,
        estimatedSmsAvailable: null,
      });
      expect(result.topUpUrl).toContain('portal.bytewavenetworks.com');
      const url = new URL(String(fetchSpy.mock.calls[0][0]));
      expect(url.pathname).toBe('/api/http/balance');
      expect(url.searchParams.get('api_token')).toBe('saved-balance-key');
      expect(JSON.stringify(result)).not.toContain('saved-balance-key');
    });

    it('estimates SMS available when the portal only reports a KES balance', async () => {
      jest.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: 'success',
            message: null,
            data: { remaining_balance: 'Ksh50.40', expired_on: '14th Oct 25, 12:13 PM' },
          }),
      } as any);

      mockSettings = makeSettings({
        'gateway.sms.bytewave.api_key': 'saved-balance-key',
        'gateway.sms.bytewave.api_url': 'https://portal.bytewavenetworks.com/api/http/',
      });
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunicationService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: SystemSettingsService, useValue: mockSettings },
        ],
      }).compile();
      const localService = module.get<CommunicationService>(CommunicationService);

      const result = await localService.getByteWaveBalance();

      expect(result).toMatchObject({
        success: true,
        balanceKes: 50.4,
        smsAvailable: null,
        estimatedSmsAvailable: 201,
        costPerSmsKes: 0.25,
      });
    });

    it('reports a failed balance lookup instead of inventing numbers', async () => {
      jest.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'error', message: 'bad token' }),
      } as any);

      mockSettings = makeSettings({
        'gateway.sms.bytewave.api_key': 'bad-key',
        'gateway.sms.bytewave.api_url': 'https://portal.bytewavenetworks.com/api/http/',
      });
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CommunicationService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: SystemSettingsService, useValue: mockSettings },
        ],
      }).compile();
      const localService = module.get<CommunicationService>(CommunicationService);

      const result = await localService.getByteWaveBalance();

      expect(result).toMatchObject({ success: false, balanceKes: null, smsAvailable: null });
      expect(JSON.stringify(result)).not.toContain('bad-key');
    });
  });
});
