import { InvoicePdfService } from './invoice-pdf.service';

describe('InvoicePdfService', () => {
  const service = new InvoicePdfService();

  it('produces a real PDF on the Calyvia letterhead', async () => {
    const result = await service.generate({
      invoice: {
        invoiceNumber: 'INV-2026-0042',
        issueDate: new Date('2026-11-26T09:00:00Z'),
        dueDate: new Date('2026-12-03T09:00:00Z'),
        status: 'ISSUED',
        subtotal: 117000,
        discount: 0,
        totalAmountKES: 117000,
        paidAmountKES: 0,
        balanceKES: 117000,
        notes: 'Bill to: Jane Doe | Phone: 0703377395 | Source: MANUAL',
      },
      items: [
        { description: 'Detox', quantity: 7, unitPriceKES: 15000, lineTotal: 105000 },
        { description: 'Assessment', quantity: 1, unitPriceKES: 12000, lineTotal: 12000 },
      ],
      payments: [],
      patient: null,
    });

    const header = Buffer.from(result.bytes.slice(0, 5)).toString('ascii');
    expect(header).toBe('%PDF-');
    expect(result.bytes.byteLength).toBeGreaterThan(1000);
    expect(result.fileName).toBe('Calyvia-INV-2026-0042.pdf');
  });

  it('falls back to a plain page when the letterhead asset is absent', async () => {
    const spy = jest
      .spyOn(service as any, 'letterheadBytes')
      .mockReturnValue(null);
    try {
      const result = await service.generate({
        invoice: { invoiceNumber: 'INV-TEST' },
        items: [],
        payments: [],
      });
      expect(Buffer.from(result.bytes.slice(0, 5)).toString('ascii')).toBe('%PDF-');
    } finally {
      spy.mockRestore();
    }
  });
});
