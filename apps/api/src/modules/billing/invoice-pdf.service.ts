import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

/** Calyvia brand palette, matched to the admin theme. */
const INK = rgb(0.11, 0.16, 0.17);
const MUTED = rgb(0.44, 0.49, 0.5);
const BRAND = rgb(0.05, 0.3, 0.28);
const BRAND_LIGHT = rgb(0.89, 0.95, 0.94);
const GOLD = rgb(0.76, 0.58, 0.26);
const PANEL = rgb(0.97, 0.98, 0.98);
const LINE = rgb(0.83, 0.87, 0.87);
const WHITE = rgb(1, 1, 1);

/**
 * Builds a professional PDF invoice on top of Calyvia's branded letterhead.
 *
 * The letterhead is a one-page US Letter PDF (logo + contact strip at the top).
 * We load it as the base document and draw the invoice below that strip, so
 * every PDF looks like it was typed on the clinic's stationery.
 */
@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  private value(source: any, ...keys: string[]): any {
    for (const key of keys) {
      const found = source?.[key];
      if (found !== undefined && found !== null && found !== '') return found;
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

  private money(source: any): string {
    const amount = Number(source ?? 0);
    return `KES ${(Number.isFinite(amount) ? amount : 0).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private date(source: any): string {
    if (!source) return '-';
    const parsed = new Date(source);
    if (Number.isNaN(parsed.getTime())) return String(source);
    return parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private text(
    page: PDFPage,
    content: any,
    x: number,
    y: number,
    font: PDFFont,
    size: number,
    color = INK,
    align?: { right?: number; center?: number },
  ) {
    const clean = String(content ?? '');
    const width = font.widthOfTextAtSize(clean, size);
    const left =
      align?.right !== undefined
        ? align.right - width
        : align?.center !== undefined
          ? align.center - width / 2
          : x;
    page.drawText(clean, { x: left, y, size, font, color });
  }

  private fit(content: any, font: PDFFont, size: number, maxWidth: number): string {
    const clean = String(content ?? '');
    if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
    let value = clean;
    while (value.length > 3 && font.widthOfTextAtSize(`${value}...`, size) > maxWidth) {
      value = value.slice(0, -1);
    }
    return `${value}...`;
  }

  private patientName(patient: any): string {
    return [this.value(patient, 'firstName', 'first_name'), this.value(patient, 'lastName', 'last_name')]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private noteValue(notes: string, label: string): string {
    return notes.match(new RegExp(`${label}:\\s*([^|]+)`, 'i'))?.[1]?.trim() || '';
  }

  async generate(data: {
    invoice: any;
    items: any[];
    payments: any[];
    patient?: any | null;
  }): Promise<{ bytes: Uint8Array; fileName: string }> {
    const letterhead = this.letterheadBytes();
    const doc = letterhead ? await PDFDocument.load(letterhead) : await PDFDocument.create();
    const page = letterhead ? doc.getPage(0) : doc.addPage([612, 792]);
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    if (!letterhead) {
      this.text(page, 'CALYVIA WELLNESS CENTER', 48, 752, bold, 19, BRAND);
      this.text(
        page,
        'Ruiru, Mugutha  |  +254 700 534 306  |  calyviawellness.co.ke',
        48,
        734,
        regular,
        9,
        MUTED,
      );
      page.drawLine({
        start: { x: 48, y: 722 },
        end: { x: 564, y: 722 },
        thickness: 2,
        color: BRAND,
      });
    }

    const invoice = data.invoice ?? {};
    const number = String(this.value(invoice, 'invoiceNumber', 'invoice_number') || 'DRAFT');
    const issue = this.date(
      this.value(invoice, 'issueDate', 'issue_date', 'createdAt', 'created_at'),
    );
    const due = this.date(this.value(invoice, 'dueDate', 'due_date'));
    const status = String(this.value(invoice, 'status') || 'ISSUED').toUpperCase();
    const notes = String(this.value(invoice, 'notes') || '');

    // --- Header banner -----------------------------------------------------
    page.drawRectangle({ x: 48, y: 612, width: 516, height: 46, color: BRAND });
    page.drawRectangle({ x: 48, y: 612, width: 5, height: 46, color: GOLD });
    this.text(page, 'INVOICE', 66, 628, bold, 22, WHITE);
    this.text(page, `No. ${number}`, 67, 615, regular, 9, rgb(0.82, 0.92, 0.9));
    this.text(page, `Issued  ${issue}`, 556, 630, regular, 9, WHITE, { right: 556 });
    this.text(page, `Due  ${due}`, 556, 618, regular, 9, WHITE, { right: 556 });

    // --- Bill-to and account cards -----------------------------------------
    page.drawRectangle({
      x: 48,
      y: 520,
      width: 300,
      height: 74,
      color: PANEL,
      borderColor: LINE,
      borderWidth: 0.7,
    });
    this.text(page, 'BILL TO', 60, 578, bold, 8, BRAND);
    const billName = this.patientName(data.patient) || this.noteValue(notes, 'Bill to') || 'Walk-in client';
    const billPhone = this.value(data.patient, 'phone') || this.noteValue(notes, 'Phone') || '-';
    const upi = this.value(data.patient, 'upi', 'registrationNumber');
    this.text(page, this.fit(billName, bold, 12, 276), 60, 558, bold, 12, INK);
    this.text(page, `Phone: ${billPhone}`, 60, 542, regular, 9, MUTED);
    if (upi) this.text(page, `UPI: ${upi}`, 60, 529, regular, 8, MUTED);

    page.drawRectangle({
      x: 360,
      y: 520,
      width: 204,
      height: 74,
      color: PANEL,
      borderColor: LINE,
      borderWidth: 0.7,
    });
    this.text(page, 'ACCOUNT', 372, 578, bold, 8, BRAND);
    const paid = Number(this.value(invoice, 'paidAmountKES', 'paid_amount', 'paidAmount') ?? 0);
    const badgeColor = /FULLY_PAID/.test(status)
      ? rgb(0.87, 0.95, 0.88)
      : /PARTIALLY_PAID/.test(status)
        ? rgb(1, 0.95, 0.82)
        : BRAND_LIGHT;
    const badgeTextColor = /FULLY_PAID/.test(status)
      ? rgb(0.08, 0.4, 0.24)
      : /PARTIALLY_PAID/.test(status)
        ? rgb(0.55, 0.38, 0.05)
        : BRAND;
    page.drawRectangle({ x: 372, y: 548, width: 104, height: 19, color: badgeColor });
    this.text(page, status.replace(/_/g, ' '), 424, 554, bold, 8, badgeTextColor, {
      center: 424,
    });
    this.text(page, `Currency  KES`, 372, 534, regular, 9, MUTED);
    this.text(page, `Paid  ${this.money(paid)}`, 552, 534, regular, 9, MUTED, { right: 552 });

    // --- Line items --------------------------------------------------------
    page.drawRectangle({ x: 48, y: 476, width: 516, height: 20, color: BRAND_LIGHT });
    this.text(page, 'DESCRIPTION', 58, 482, bold, 8, BRAND);
    this.text(page, 'QTY', 368, 482, bold, 8, BRAND, { right: 368 });
    this.text(page, 'UNIT PRICE', 464, 482, bold, 8, BRAND, { right: 464 });
    this.text(page, 'AMOUNT', 552, 482, bold, 8, BRAND, { right: 552 });
    page.drawLine({ start: { x: 48, y: 476 }, end: { x: 564, y: 476 }, thickness: 1, color: BRAND });

    const allItems = Array.isArray(data.items) ? data.items : [];
    const shownItems = allItems.slice(0, 24);
    const rowHeight = Math.min(22, Math.max(12, (466 - 190) / Math.max(shownItems.length, 1)));
    let y = 466;
    shownItems.forEach((item, index) => {
      if (index % 2 === 1) {
        page.drawRectangle({ x: 48, y: y - 3, width: 516, height: rowHeight, color: PANEL });
      }
      const description = String(this.value(item, 'description', 'itemName') || 'Service');
      const qty = Number(this.value(item, 'quantity') ?? 1);
      const unit = Number(this.value(item, 'unitPriceKES', 'unit_price', 'unitPrice') ?? 0);
      const amount = Number(
        this.value(item, 'lineTotal', 'line_total', 'amountKES', 'amount') ?? qty * unit,
      );
      this.text(page, this.fit(description, regular, 9, 290), 58, y, regular, 9, INK);
      this.text(page, String(qty), 368, y, regular, 9, INK, { right: 368 });
      this.text(page, this.money(unit), 464, y, regular, 9, INK, { right: 464 });
      this.text(page, this.money(amount), 552, y, bold, 9, INK, { right: 552 });
      y -= rowHeight;
    });
    if (allItems.length > shownItems.length) {
      this.text(
        page,
        `+ ${allItems.length - shownItems.length} more line item(s) — see the system record.`,
        58,
        Math.max(y, 190),
        regular,
        8,
        MUTED,
      );
    }
    page.drawLine({
      start: { x: 48, y: Math.max(y - 6, 184) },
      end: { x: 564, y: Math.max(y - 6, 184) },
      thickness: 0.8,
      color: LINE,
    });

    // --- Totals ------------------------------------------------------------
    const subtotal = Number(
      this.value(invoice, 'subtotal', 'subTotal') ??
        allItems.reduce(
          (sum, item) =>
            sum +
            Number(
              this.value(item, 'lineTotal', 'line_total', 'amountKES', 'amount') ??
                Number(this.value(item, 'quantity') ?? 1) *
                  Number(this.value(item, 'unitPriceKES', 'unit_price', 'unitPrice') ?? 0),
            ),
          0,
        ),
    );
    const discount = Number(this.value(invoice, 'discount') ?? 0);
    const total = Number(
      this.value(invoice, 'totalAmountKES', 'total_amount', 'totalAmount') ?? subtotal - discount,
    );
    const balance = Number(
      this.value(invoice, 'balanceKES', 'balance_due', 'balanceDue') ?? Math.max(0, total - paid),
    );

    page.drawRectangle({
      x: 360,
      y: 58,
      width: 204,
      height: 94,
      color: PANEL,
      borderColor: LINE,
      borderWidth: 0.7,
    });
    let ty = 138;
    const totalRow = (label: string, amount: string, strong = false, accent = false) => {
      this.text(page, label, 372, ty, strong ? bold : regular, strong ? 10 : 9, accent ? BRAND : MUTED);
      this.text(page, amount, 552, ty, strong ? bold : regular, strong ? 10 : 9, INK, {
        right: 552,
      });
      ty -= 16;
    };
    totalRow('Subtotal', this.money(subtotal));
    if (discount) totalRow('Discount', `- ${this.money(discount)}`);
    page.drawLine({ start: { x: 370, y: ty + 10 }, end: { x: 554, y: ty + 10 }, thickness: 0.7, color: LINE });
    totalRow('TOTAL', this.money(total), true, true);
    totalRow('Paid', this.money(paid));
    totalRow('Balance due', this.money(balance), true, true);

    // --- Payment history ---------------------------------------------------
    this.text(page, 'PAYMENT HISTORY', 58, 142, bold, 8, BRAND);
    const payments = Array.isArray(data.payments) ? data.payments : [];
    if (!payments.length) {
      this.text(page, 'No payments recorded yet.', 58, 127, regular, 8, MUTED);
    } else {
      payments.slice(0, 4).forEach((payment, index) => {
        const row = 127 - index * 15;
        const ref = this.value(
          payment,
          'receiptNumber',
          'receipt_number',
          'paymentReference',
          'payment_reference',
        );
        const method = String(this.value(payment, 'paymentMethod', 'payment_method') || '').replace(/_/g, ' ');
        const amount = Number(this.value(payment, 'amountKES', 'amount_paid', 'amount') ?? 0);
        this.text(
          page,
          this.fit(`${this.date(this.value(payment, 'paymentDate', 'payment_date'))}  ${method}  ${ref || ''}`, regular, 8, 232),
          58,
          row,
          regular,
          8,
          MUTED,
        );
        this.text(page, this.money(amount), 300, row, regular, 8, INK, { right: 300 });
      });
    }

    const cleanNotes = notes
      .split('|')
      .map((part) => part.trim())
      .filter((part) => part && !/^(Bill to|Phone|Source):/i.test(part))
      .join(' | ');
    if (cleanNotes) {
      this.text(page, this.fit(cleanNotes, regular, 8, 508), 58, 58, regular, 8, MUTED);
    }

    // --- Footer ------------------------------------------------------------
    page.drawLine({ start: { x: 48, y: 42 }, end: { x: 564, y: 42 }, thickness: 0.7, color: LINE });
    this.text(page, 'Thank you for choosing Calyvia Wellness Center.', 48, 28, regular, 8, MUTED);
    this.text(
      page,
      'Payment: M-Pesa Paybill / Bank transfer / Cash   |   Rehabilitation | Detox | Counselling | Family Support | Aftercare',
      48,
      16,
      regular,
      7,
      GOLD,
    );

    return {
      bytes: await doc.save(),
      fileName: `Calyvia-${number.replace(/[^A-Za-z0-9-]/g, '')}.pdf`,
    };
  }
}
