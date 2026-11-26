import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

/**
 * Builds a real PDF invoice on top of Calyvia's branded letterhead.
 *
 * The letterhead is a one-page US Letter PDF (logo + contact strip at the top).
 * We load it as the base document and draw the invoice underneath that strip,
 * so every PDF is indistinguishable from one typed on the clinic's stationery.
 */
@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  private interfaceValue(source: any, ...keys: string[]): any {
    for (const key of keys) {
      const value = source?.[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return null;
  }

  private letterheadBytes(): Uint8Array | null {
    const candidates = [
      path.join(process.cwd(), 'apps', 'api', 'assets', 'calyvia-letterhead.pdf'),
      path.join(process.cwd(), 'assets', 'calyvia-letterhead.pdf'),
      path.join(__dirname, '..', '..', '..', 'assets', 'calyvia-letterhead.pdf'),
      path.join(__dirname, '..', '..', 'assets', 'calyvia-letterhead.pdf'),
    ];
    for (const file of candidates) {
      if (fs.existsSync(file)) return fs.readFileSync(file);
    }
    this.logger.warn('Calyvia letterhead not found; generating invoice on a plain page.');
    return null;
  }

  private money(value: any): string {
    const n = Number(value ?? 0);
    return `KES ${(Number.isFinite(n) ? n : 0).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private date(value: any): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private draw(
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    font: PDFFont,
    size: number,
    color = rgb(0.16, 0.19, 0.2),
    rightEdge?: number,
  ) {
    const clean = String(text ?? '');
    const left = rightEdge === undefined ? x : rightEdge - font.widthOfTextAtSize(clean, size);
    page.drawText(clean, { x: left, y, size, font, color });
  }

  private patientName(patient: any): string {
    const names = [
      this.interfaceValue(patient, 'firstName', 'first_name'),
      this.interfaceValue(patient, 'lastName', 'last_name'),
    ].filter(Boolean);
    return names.join(' ').trim();
  }

  async generate(data: {
    invoice: any;
    items: any[];
    payments: any[];
    patient?: any | null;
  }): Promise<{ bytes: Uint8Array; fileName: string }> {
    const letterhead = this.letterheadBytes();
    const doc = letterhead
      ? await PDFDocument.load(letterhead)
      : await PDFDocument.create();
    const page = letterhead ? doc.getPage(0) : doc.addPage([612, 792]);
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.16, 0.19, 0.2);
    const muted = rgb(0.42, 0.46, 0.49);
    const brand = rgb(0.06, 0.33, 0.3);
    const line = rgb(0.82, 0.85, 0.85);

    if (!letterhead) {
      this.draw(page, 'CALYVIA WELLNESS CENTER', 48, 748, bold, 18, brand);
      this.draw(page, 'Ruiru, Mugutha | Tel: +254 700 534 306 | calyviawellness.co.ke', 48, 728, regular, 9, muted);
    }

    const invoice = data.invoice ?? {};
    const number =
      this.interfaceValue(invoice, 'invoiceNumber', 'invoice_number') || 'DRAFT';
    const issue = this.date(
      this.interfaceValue(invoice, 'issueDate', 'issue_date', 'createdAt', 'created_at'),
    );
    const due = this.date(this.interfaceValue(invoice, 'dueDate', 'due_date'));
    const status = String(
      this.interfaceValue(invoice, 'status') ?? 'ISSUED',
    ).toUpperCase();

    this.draw(page, 'INVOICE', 48, 622, bold, 24, brand);
    this.draw(page, `No. ${number}`, 48, 602, regular, 10, muted);

    this.draw(page, 'Issued', 388, 620, regular, 9, muted);
    this.draw(page, issue, 562, 620, regular, 10, ink, 562);
    this.draw(page, 'Due', 388, 602, regular, 9, muted);
    this.draw(page, due, 562, 602, regular, 10, ink, 562);
    this.draw(page, 'Status', 388, 584, regular, 9, muted);
    this.draw(page, status, 562, 584, bold, 10, brand, 562);

    page.drawLine({ start: { x: 48, y: 566 }, end: { x: 564, y: 566 }, thickness: 1, color: line });

    // Manual invoices may only carry a free-form "Bill to" note; linked ones use
    // the patient record. Both are supported.
    const notes = String(this.interfaceValue(invoice, 'notes') ?? '');
    const noteValue = (label: string) =>
      notes.match(new RegExp(`${label}:\\s*([^|]+)`, 'i'))?.[1]?.trim() || '';
    const name =
      this.patientName(data.patient) || noteValue('Bill to') || 'Walk-in client';
    const phone =
      this.interfaceValue(data.patient, 'phone') || noteValue('Phone') || '-';
    const upi = this.interfaceValue(data.patient, 'upi', 'registrationNumber') || '';

    this.draw(page, 'BILL TO', 48, 546, bold, 10, brand);
    this.draw(page, name, 48, 528, bold, 11, ink);
    if (upi) this.draw(page, `UPI: ${upi}`, 48, 512, regular, 9, muted);
    this.draw(page, `Phone: ${phone}`, 48, upi ? 496 : 512, regular, 9, muted);

    this.draw(page, 'DESCRIPTION', 48, 474, bold, 9, muted);
    this.draw(page, 'QTY', 336, 474, bold, 9, muted, 376);
    this.draw(page, 'UNIT PRICE', 388, 474, bold, 9, muted, 468);
    this.draw(page, 'AMOUNT', 480, 474, bold, 9, muted, 562);
    page.drawLine({ start: { x: 48, y: 466 }, end: { x: 564, y: 466 }, thickness: 1, color: line });

    const items = Array.isArray(data.items) ? data.items : [];
    const rowHeight = Math.min(22, Math.max(11, (466 - 130) / Math.max(items.length, 1)));
    let y = 450;
    for (const item of items) {
      const description = String(
        this.interfaceValue(item, 'description', 'itemName') ?? 'Service',
      );
      const qty = Number(this.interfaceValue(item, 'quantity') ?? 1);
      const unit = Number(
        this.interfaceValue(item, 'unitPriceKES', 'unit_price', 'unitPrice') ?? 0,
      );
      const amount = Number(
        this.interfaceValue(item, 'lineTotal', 'line_total', 'amountKES', 'amount') ??
          qty * unit,
      );
      this.draw(page, description.slice(0, 62), 48, y, regular, 10, ink);
      this.draw(page, String(qty), 376, y, regular, 10, ink, 376);
      this.draw(page, this.money(unit), 468, y, regular, 10, ink, 468);
      this.draw(page, this.money(amount), 562, y, regular, 10, ink, 562);
      y -= rowHeight;
    }

    const subtotal = Number(
      this.interfaceValue(invoice, 'subtotal', 'subTotal') ??
        items.reduce(
          (sum, item) =>
            sum +
            Number(
              this.interfaceValue(item, 'lineTotal', 'line_total', 'amountKES', 'amount') ??
                Number(this.interfaceValue(item, 'quantity') ?? 1) *
                  Number(
                    this.interfaceValue(item, 'unitPriceKES', 'unit_price', 'unitPrice') ?? 0,
                  ),
            ),
          0,
        ),
    );
    const discount = Number(this.interfaceValue(invoice, 'discount') ?? 0);
    const total = Number(
      this.interfaceValue(invoice, 'totalAmountKES', 'total_amount', 'totalAmount') ?? subtotal - discount,
    );
    const paid = Number(
      this.interfaceValue(invoice, 'paidAmountKES', 'paid_amount', 'paidAmount') ?? 0,
    );
    const balance = Number(
      this.interfaceValue(invoice, 'balanceKES', 'balance_due', 'balanceDue') ?? Math.max(0, total - paid),
    );

    let ty = Math.min(y - 12, 116);
    const totalRow = (label: string, value: string, strong = false) => {
      this.draw(page, label, 400, ty, strong ? bold : regular, strong ? 11 : 10, strong ? brand : muted);
      this.draw(page, value, 562, ty, strong ? bold : regular, strong ? 11 : 10, ink, 562);
      ty -= 16;
    };
    totalRow('Subtotal', this.money(subtotal));
    if (discount) totalRow('Discount', `- ${this.money(discount)}`);
    totalRow('TOTAL', this.money(total), true);
    totalRow('Paid', this.money(paid));
    totalRow('Balance due', this.money(balance), true);

    const payments = Array.isArray(data.payments) ? data.payments : [];
    if (payments.length) {
      this.draw(page, 'PAYMENTS', 48, 116, bold, 9, brand);
      payments.slice(0, 4).forEach((payment, index) => {
        const label = this.interfaceValue(
          payment,
          'receiptNumber',
          'receipt_number',
          'paymentReference',
          'payment_reference',
        );
        const method = String(this.interfaceValue(payment, 'paymentMethod', 'payment_method') ?? '');
        const amount = Number(this.interfaceValue(payment, 'amountKES', 'amount_paid', 'amount') ?? 0);
        this.draw(
          page,
          `${this.date(this.interfaceValue(payment, 'paymentDate', 'payment_date'))}  ${method}  ${label ?? ''}`.slice(0, 58),
          48,
          100 - index * 12,
          regular,
          8,
          muted,
        );
        this.draw(page, this.money(amount), 270, 100 - index * 12, regular, 8, ink, 270);
      });
    }

    const cleanNotes = notes
      .split('|')
      .map((part) => part.trim())
      .filter((part) => part && !/^(Bill to|Phone|Source):/i.test(part))
      .join(' | ');
    if (cleanNotes) {
      this.draw(page, cleanNotes.slice(0, 80), 48, 52, regular, 8, muted);
    }
    page.drawLine({ start: { x: 48, y: 42 }, end: { x: 564, y: 42 }, thickness: 0.7, color: line });
    this.draw(
      page,
      'Thank you for choosing Calyvia Wellness Center. Payment: M-Pesa Paybill / Bank transfer / Cash.',
      48,
      28,
      regular,
      8,
      muted,
    );

    return {
      bytes: await doc.save(),
      fileName: `Calyvia-${number.replace(/[^A-Za-z0-9-]/g, '')}.pdf`,
    };
  }
}
