import { MpesaService } from './mpesa.service';

const ENV_KEYS = [
  'MPESA_ENVIRONMENT',
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_SHORTCODE',
  'MPESA_PASSKEY',
  'MPESA_CALLBACK_URL',
  'MPESA_TRANSACTION_TYPE',
  'MPESA_CALLBACK_ALLOWED_IPS',
];

describe('MpesaService (Daraja STK Push)', () => {
  const originalEnv: Record<string, string | undefined> = {};
  let originalFetch: any;

  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.MPESA_ENVIRONMENT = 'production';
    process.env.MPESA_CONSUMER_KEY = 'test-consumer-key';
    process.env.MPESA_CONSUMER_SECRET = 'test-consumer-secret';
    process.env.MPESA_SHORTCODE = '123456';
    process.env.MPESA_PASSKEY = 'test-passkey';
    process.env.MPESA_CALLBACK_URL =
      'https://api.calyviawellness.co.ke/api/v1/integrations/mpesa/callback';
    delete process.env.MPESA_TRANSACTION_TYPE;
    delete process.env.MPESA_CALLBACK_ALLOWED_IPS;
    originalFetch = (global as any).fetch;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    (global as any).fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('requests a token, sends a Paybill STK push and persists the pending checkout', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'test-token', expires_in: '3599' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ResponseCode: '0',
          ResponseDescription: 'Success. Request accepted for processing',
          MerchantRequestID: 'MR-TEST-1',
          CheckoutRequestID: 'ws_CO_TEST_1',
          CustomerMessage: 'Success',
        }),
      });

    const prisma: any = {
      mpesaTransaction: { create: jest.fn().mockResolvedValue({}) },
    };
    const communication: any = { sendMessage: jest.fn(), sendWhatsAppDocument: jest.fn() };
    const pdf: any = { generate: jest.fn() };
    const service = new MpesaService(prisma, communication, pdf);

    const result = await service.initiateStk({
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-2026-0042',
      phoneNumber: '0703377395',
      amountKES: 1000,
    });

    const calls = ((global as any).fetch as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe(
      'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    );
    expect(calls[0][1].headers.Authorization).toMatch(/^Basic /);
    expect(calls[1][0]).toBe(
      'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    );

    const sentBody = JSON.parse(calls[1][1].body);
    expect(sentBody).toMatchObject({
      BusinessShortCode: '123456',
      TransactionType: 'CustomerPayBillOnline',
      Amount: 1000,
      PartyA: '254703377395',
      PartyB: '123456',
      PhoneNumber: '254703377395',
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: 'INV20260042',
    });
    const decodedPassword = Buffer.from(sentBody.Password, 'base64').toString();
    expect(decodedPassword.startsWith('123456test-passkey')).toBe(true);
    expect(decodedPassword).toHaveLength(`123456test-passkey${sentBody.Timestamp}`.length);

    expect(prisma.mpesaTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          checkoutRequestId: 'ws_CO_TEST_1',
          merchantRequestId: 'MR-TEST-1',
          resultCode: 1019,
          rawPayload: expect.objectContaining({
            status: 'PENDING_PIN_PROMPT',
            invoiceId: 'inv-1',
            requestedAmount: 1000,
          }),
        }),
      }),
    );
    expect(result.CheckoutRequestID).toBe('ws_CO_TEST_1');
    expect(result.status).toBe('PENDING_PIN_PROMPT');
  });

  it('posts a successful callback to the invoice ledger and sends a receipt once', async () => {
    const pending: any = {
      id: 'mpesa-1',
      checkoutRequestId: 'ws_CO_TEST_2',
      merchantRequestId: 'MR-TEST-2',
      amount: 1000,
      phoneNumber: '254703377395',
      resultCode: 1019,
      resultDesc: 'Awaiting customer PIN entry',
      rawPayload: {
        status: 'PENDING_PIN_PROMPT',
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-2026-0042',
        requestedAmount: 1000,
      },
    };
    const invoice: any = {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-0042',
      totalAmountKES: 1000,
      paidAmountKES: 0,
      balanceKES: 1000,
      notes:
        'Bill to: Jane Doe | Phone: 0703377395 | WhatsApp: 0723456789 | Source: MANUAL',
    };
    const tx: any = {
      mpesaTransaction: {
        findUnique: jest.fn().mockResolvedValue(pending),
        update: jest.fn().mockResolvedValue({}),
      },
      invoice: {
        findUnique: jest.fn().mockResolvedValue(invoice),
        update: jest.fn().mockResolvedValue({}),
      },
      payment: { create: jest.fn().mockResolvedValue({ id: 'pay-1' }) },
      patient: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const prisma: any = {
      ...tx,
      mpesaTransaction: { ...tx.mpesaTransaction, create: jest.fn() },
      invoiceItem: { findMany: jest.fn().mockResolvedValue([]) },
      payment: { ...tx.payment, findMany: jest.fn().mockResolvedValue([]) },
    };
    const communication: any = {
      sendMessage: jest.fn().mockResolvedValue({ id: 'log-1', status: 'SENT' }),
      sendWhatsAppDocument: jest.fn().mockResolvedValue({ id: 'log-2', status: 'SENT' }),
    };
    const pdf: any = {
      generate: jest.fn().mockResolvedValue({
        bytes: new Uint8Array([37, 80, 68, 70]),
        fileName: 'Calyvia-INV-2026-0042.pdf',
      }),
    };
    const service = new MpesaService(prisma, communication, pdf);

    const result = await service.handleCallback({
      Body: {
        stkCallback: {
          MerchantRequestID: 'MR-TEST-2',
          CheckoutRequestID: 'ws_CO_TEST_2',
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 1000 },
              { Name: 'MpesaReceiptNumber', Value: 'NLJ7RT61SV' },
              { Name: 'TransactionDate', Value: 20261126103000 },
              { Name: 'PhoneNumber', Value: 254703377395 },
            ],
          },
        },
      },
    });

    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: 'inv-1',
          amountKES: 1000,
          paymentMethod: 'MPESA_STK',
          transactionRef: 'NLJ7RT61SV',
          receivedBy: 'MPESA_STK_CALLBACK',
        }),
      }),
    );
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FULLY_PAID', balanceKES: 0 }),
      }),
    );
    expect(tx.mpesaTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId: 'pay-1',
          mpesaReceiptNumber: 'NLJ7RT61SV',
          rawPayload: expect.objectContaining({ status: 'PAID' }),
        }),
      }),
    );
    expect(communication.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: '0703377395',
        channel: 'SMS',
        templateKey: 'PAYMENT_RECEIPT',
        variables: expect.objectContaining({
          patient_name: 'Jane Doe',
          invoice_number: 'INV-2026-0042',
          balance: 'KES 0.00',
        }),
      }),
    );
    expect(pdf.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice: expect.objectContaining({ id: 'inv-1' }),
      }),
    );
    expect(communication.sendWhatsAppDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: '0723456789',
        fileName: 'Calyvia-INV-2026-0042.pdf',
        recipientType: 'PATIENT',
      }),
    );
    expect(result).toMatchObject({
      ResultCode: 0,
      receipt: 'NLJ7RT61SV',
      paymentId: 'pay-1',
    });
  });

  it('falls back to the guardian WhatsApp number, then the invoice phone', async () => {
    const guardianPrisma: any = {
      emergencyContact: {
        findMany: jest.fn().mockResolvedValue([
          { phone: '0703377395', alternativePhone: '+254723456789' },
        ]),
      },
    };
    const service = new MpesaService(guardianPrisma, {} as any, {} as any);

    const guardianRecipient = await (service as any).resolveWhatsappRecipient(
      {
        notes: 'Bill to: Jane Doe | Phone: 0703377395 | Source: MANUAL',
        patientId: 'pat-1',
        phone: '254703377395',
      },
      null,
    );
    expect(guardianRecipient).toBe('+254723456789');

    const phonePrisma: any = { emergencyContact: { findMany: jest.fn().mockResolvedValue([]) } };
    const fallbackService = new MpesaService(phonePrisma, {} as any, {} as any);
    const invoicePhoneRecipient = await (fallbackService as any).resolveWhatsappRecipient(
      {
        notes: 'Bill to: Jane Doe | Phone: 0703377395 | Source: MANUAL',
        patientId: 'pat-1',
        phone: '254712345678',
      },
      null,
    );
    expect(invoicePhoneRecipient).toBe('0703377395');
  });

  it('does not post a payment for a duplicate callback', async () => {
    const paid: any = {
      checkoutRequestId: 'ws_CO_TEST_3',
      merchantRequestId: 'MR-TEST-3',
      amount: 1000,
      phoneNumber: '254703377395',
      paymentId: 'pay-1',
      mpesaReceiptNumber: 'NLJ7RT61SV',
      resultCode: 0,
      resultDesc: 'Success',
      rawPayload: { status: 'PAID', invoiceId: 'inv-1', requestedAmount: 1000 },
    };
    const prisma: any = {
      mpesaTransaction: {
        findUnique: jest.fn().mockResolvedValue(paid),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
      patient: { findUnique: jest.fn() },
    };
    const communication: any = { sendMessage: jest.fn(), sendWhatsAppDocument: jest.fn() };
    const pdf: any = { generate: jest.fn() };
    const service = new MpesaService(prisma, communication, pdf);

    const result = await service.handleCallback({
      Body: {
        stkCallback: {
          MerchantRequestID: 'MR-TEST-3',
          CheckoutRequestID: 'ws_CO_TEST_3',
          ResultCode: 0,
          ResultDesc: 'Success',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 1000 },
              { Name: 'MpesaReceiptNumber', Value: 'NLJ7RT61SV' },
              { Name: 'PhoneNumber', Value: 254703377395 },
            ],
          },
        },
      },
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(communication.sendMessage).not.toHaveBeenCalled();
    expect(communication.sendWhatsAppDocument).not.toHaveBeenCalled();
    expect(result.alreadyProcessed).toBe(true);
  });
});
