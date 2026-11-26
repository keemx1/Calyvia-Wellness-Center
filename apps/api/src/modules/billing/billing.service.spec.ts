import { Test, TestingModule } from '@nestjs/testing';
import { BillingService, CreateInvoiceDto } from './billing.service';
import { PrismaService } from '../../database/prisma.service';
import { CommunicationService } from '../communication/communication.service';
import { InvoicePdfService } from './invoice-pdf.service';

describe('BillingService (Invoicing Center)', () => {
  let service: BillingService;
  let mockPrisma: any;
  let mockCommunication: any;
  let mockPdf: any;

  beforeEach(async () => {
    mockPrisma = {
      invoice: {
        create: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: 'inv-test-1',
            invoiceNumber: args.data.invoiceNumber,
            totalAmountKES: args.data.totalAmountKES,
            balanceKES: args.data.balanceKES,
            paidAmountKES: args.data.paidAmountKES,
            notes: args.data.notes,
            issueDate: args.data.issueDate,
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-test-1',
          invoiceNumber: 'INV-2026-0042',
          totalAmountKES: 117000,
          paidAmountKES: 0,
          notes: 'Bill to: Jane Doe | Phone: 0703377395 | Source: MANUAL',
        }),
        update: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
      },
      invoiceItem: {
        create: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
        findMany: jest.fn().mockResolvedValue([
          { description: 'Detox', quantity: 7, unitPriceKES: 15000, lineTotal: 105000 },
        ]),
      },
      payment: {
        create: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
        findMany: jest.fn().mockResolvedValue([]),
      },
      admission: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      patient: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'patient-1',
          firstName: 'Jane',
          lastName: 'Doe',
          phone: '0703377395',
        }),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrisma)),
    };
    mockCommunication = {
      sendWhatsAppDocument: jest.fn().mockResolvedValue({
        id: 'log-1',
        provider: 'BAILEYS',
        status: 'SENT',
      }),
    };
    mockPdf = {
      generate: jest.fn().mockResolvedValue({
        bytes: new Uint8Array([37, 80, 68, 70]),
        fileName: 'Calyvia-INV-2026-0042.pdf',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CommunicationService, useValue: mockCommunication },
        { provide: InvoicePdfService, useValue: mockPdf },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculates totals and writes the fields required by the invoices table', async () => {
    const dto: CreateInvoiceDto = {
      patientId: 'patient-uuid-1',
      items: [
        { description: 'Medical Detox Inpatient Daily Fee (7 days)', quantity: 7, unitPriceKES: 15000 },
        { description: 'Comprehensive Psychiatric Intake Assessment', quantity: 1, unitPriceKES: 12000 },
      ],
    };

    const invoice = await service.createInvoice(dto);

    expect(invoice.totalAmountKES).toBe(117000);
    expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subtotal: 117000, balanceKES: 117000 }),
      }),
    );
    expect(mockPrisma.invoiceItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lineTotal: 105000 }),
      }),
    );
  });

  it('keeps walk-in bill-to details on the invoice notes', async () => {
    await service.createInvoice({
      billToName: 'Jane Doe',
      billToPhone: '0703377395',
      items: [{ description: 'Consultation', quantity: 1, unitPriceKES: 2500 }],
    });

    expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notes: expect.stringContaining('Bill to: Jane Doe'),
        }),
      }),
    );
  });

  it('auto-generates one invoice per active admission and skips today\'s auto invoice', async () => {
    mockPrisma.admission.findMany.mockResolvedValue([
      {
        id: 'adm-1',
        admissionNumber: 'ADM-2026-0001',
        patientId: 'patient-1',
        programType: 'DETOX_ONLY',
      },
      {
        id: 'adm-2',
        admissionNumber: 'ADM-2026-0002',
        patientId: 'patient-2',
        programType: 'OUTPATIENT',
      },
    ]);
    mockPrisma.invoice.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'existing',
          notes: 'Source: AUTO | Admission ADM-2026-0002',
          issueDate: new Date(),
        },
      ]);

    const result = await service.generateAutomaticInvoices();

    expect(result.generated).toBe(1);
    expect(result.skipped).toBe(1);
    expect(mockPrisma.invoice.create).toHaveBeenCalledTimes(1);
  });

  it('sends a real PDF attachment to the patient WhatsApp number', async () => {
    const result = await service.sendInvoiceViaWhatsApp('inv-test-1');

    expect(mockPdf.generate).toHaveBeenCalled();
    expect(mockCommunication.sendWhatsAppDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: '0703377395',
        fileName: 'Calyvia-INV-2026-0042.pdf',
      }),
    );
    expect(result.status).toBe('SENT');
  });

  it('accepts an override recipient when the invoice has no linked phone', async () => {
    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-test-1',
      invoiceNumber: 'INV-2026-0042',
      totalAmountKES: 117000,
      notes: 'Source: MANUAL',
    });

    await service.sendInvoiceViaWhatsApp('inv-test-1', '0712345678');

    expect(mockCommunication.sendWhatsAppDocument).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: '0712345678' }),
    );
  });

  it('should trigger M-Pesa STK Push handshake without failure', async () => {
    const res = await service.triggerDarajaStk({
      invoiceId: 'inv-test-1',
      phoneNumber: '+254712345678',
      amountKES: 45000,
    });

    expect(res.ResponseCode).toBe('0');
    expect(res.CustomerMessage).toContain('STK Push prompt initiated');
  });
});
