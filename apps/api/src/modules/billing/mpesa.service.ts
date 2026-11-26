import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CommunicationChannel,
  InvoiceStatus,
  KenyaUtils,
  PaymentMethod,
} from '@calyvia/shared';
import { PrismaService } from '../../database/prisma.service';
import { CommunicationService } from '../communication/communication.service';

export interface MpesaStkInput {
  invoiceId: string;
  invoiceNumber?: string;
  phoneNumber: string;
  amountKES: number;
}

export interface MpesaStkResult {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  CustomerMessage: string;
  status: 'PENDING_PIN_PROMPT';
  amountKES: number;
  phoneNumber: string;
}

type MpesaLedgerOutcome =
  | { duplicate: true }
  | {
      duplicate: false;
      payment: any;
      invoiceId: string;
      invoiceNumber: string;
      balanceKES: number;
      amountKES: number;
      notes: any;
      patientId: string | null;
      phone: string;
    };

interface MpesaConfig {
  baseUrl: string;
  environment: 'sandbox' | 'production';
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
  transactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
}

const FACILITY_NAME = 'Calyvia Wellness Center';
const FACILITY_PHONE = '+254700534306';
const PENDING_RESULT_CODE = 1019;

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly communication: CommunicationService,
  ) {}

  private getConfig(): MpesaConfig {
    const environmentRaw = String(process.env.MPESA_ENVIRONMENT || 'production').toLowerCase();
    const environment = environmentRaw === 'sandbox' ? 'sandbox' : 'production';
    const transactionTypeRaw = String(
      process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
    );
    const transactionType =
      transactionTypeRaw === 'CustomerBuyGoodsOnline'
        ? 'CustomerBuyGoodsOnline'
        : 'CustomerPayBillOnline';

    const values: Record<string, string | undefined> = {
      MPESA_CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY,
      MPESA_CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET,
      MPESA_SHORTCODE: process.env.MPESA_SHORTCODE,
      MPESA_PASSKEY: process.env.MPESA_PASSKEY,
      MPESA_CALLBACK_URL: process.env.MPESA_CALLBACK_URL,
    };
    const missing = Object.entries(values)
      .filter(([, value]) => !value?.trim())
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new BadRequestException(
        `M-Pesa payments are not configured. Missing: ${missing.join(', ')}.`,
      );
    }

    return {
      baseUrl:
        environment === 'sandbox'
          ? 'https://sandbox.safaricom.co.ke'
          : 'https://api.safaricom.co.ke',
      environment,
      consumerKey: values.MPESA_CONSUMER_KEY!.trim(),
      consumerSecret: values.MPESA_CONSUMER_SECRET!.trim(),
      shortcode: values.MPESA_SHORTCODE!.trim(),
      passkey: values.MPESA_PASSKEY!.trim(),
      callbackUrl: values.MPESA_CALLBACK_URL!.trim(),
      transactionType,
    };
  }

  private eatTimestamp(): string {
    return new Date(Date.now() + 3 * 60 * 60 * 1000)
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
  }

  private msisdn(rawPhone: string): string {
    const normalized = KenyaUtils.normalizePhoneNumber(String(rawPhone || ''));
    const msisdn = normalized.replace(/^\+/, '');
    if (!/^254[17]\d{8}$/.test(msisdn)) {
      throw new BadRequestException('Enter a valid Kenyan M-Pesa phone number.');
    }
    return msisdn;
  }

  private async safeJson(response: any): Promise<any> {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  private async getAccessToken(config: MpesaConfig): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }

    const basic = Buffer.from(
      `${config.consumerKey}:${config.consumerSecret}`,
    ).toString('base64');

    let response: any;
    try {
      response = await fetch(
        `${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          method: 'GET',
          headers: { Authorization: `Basic ${basic}` },
        },
      );
    } catch {
      throw new ServiceUnavailableException('Could not reach the M-Pesa token service.');
    }

    if (!response?.ok) {
      throw new ServiceUnavailableException(
        `M-Pesa token request failed (HTTP ${response?.status ?? 'unknown'}).`,
      );
    }

    const body = await this.safeJson(response);
    if (!body?.access_token) {
      throw new ServiceUnavailableException('M-Pesa token response was invalid.');
    }

    const lifetimeSeconds = Number(body.expires_in) || 3600;
    this.tokenCache = {
      token: body.access_token,
      expiresAt: Date.now() + Math.max(30, lifetimeSeconds - 60) * 1000,
    };
    return body.access_token;
  }

  private generateReceiptNumber(): string {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `REC-${new Date().getFullYear()}-${rand}`;
  }

  private invoiceValue(invoice: any, ...keys: string[]): any {
    for (const key of keys) {
      const value = invoice?.[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return null;
  }

  private noteValue(notes: any, label: string): string | null {
    const match = String(notes ?? '').match(new RegExp(`${label}:\\s*([^|]+)`, 'i'));
    return match?.[1]?.trim() || null;
  }

  private patientName(patient: any): string {
    return [patient?.firstName, patient?.lastName].filter(Boolean).join(' ').trim();
  }

  private invoiceNumber(invoice: any): string {
    return String(
      this.invoiceValue(invoice, 'invoiceNumber', 'invoice_number') || 'INVOICE',
    );
  }

  private formatKes(value: number): string {
    return `KES ${Number(value || 0).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private parseMpesaDate(value: unknown): Date | null {
    const raw = String(value || '');
    if (!/^\d{14}$/.test(raw)) return null;
    const stamp = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}+03:00`;
    const parsed = new Date(stamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  /** Optional IP allowlist. Correlation by CheckoutRequestID is always enforced. */
  assertCallbackIpAllowed(request: any): void {
    const allowlist = String(process.env.MPESA_CALLBACK_ALLOWED_IPS || '')
      .split(',')
      .map((entry) => entry.trim().replace(/^::ffff:/, ''))
      .filter(Boolean);
    if (allowlist.length === 0) return;

    const forwarded = request?.headers?.['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded)
      ? forwarded[0]
      : String(forwarded || '').split(',')[0].trim();
    const candidate = (
      forwardedIp ||
      request?.ip ||
      request?.socket?.remoteAddress ||
      ''
    ).replace(/^::ffff:/, '');

    if (!allowlist.includes(candidate)) {
      throw new ForbiddenException('M-Pesa callback source is not allowed.');
    }
  }

  async initiateStk(input: MpesaStkInput): Promise<MpesaStkResult> {
    const config = this.getConfig();
    const requestedAmount = Number(input.amountKES);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new BadRequestException('A positive payment amount is required.');
    }
    const amount = Math.ceil(requestedAmount);
    const msisdn = this.msisdn(input.phoneNumber);

    const timestamp = this.eatTimestamp();
    const password = Buffer.from(
      `${config.shortcode}${config.passkey}${timestamp}`,
    ).toString('base64');
    const accountReference =
      String(input.invoiceNumber || input.invoiceId)
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 12)
        .toUpperCase() || 'CALYVIA';
    const transactionDesc = `Pay ${accountReference}`.slice(0, 13);

    const token = await this.getAccessToken(config);
    const body = {
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: config.transactionType,
      Amount: amount,
      PartyA: msisdn,
      PartyB: config.shortcode,
      PhoneNumber: msisdn,
      CallBackURL: config.callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    };

    let response: any;
    try {
      response = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ServiceUnavailableException('Could not reach the M-Pesa STK Push service.');
    }

    const result = await this.safeJson(response);
    if (!response?.ok || String(result?.ResponseCode) !== '0') {
      const description =
        result?.ResponseDescription || result?.errorMessage || 'M-Pesa rejected the request.';
      throw new BadRequestException(String(description));
    }

    const checkoutRequestId = String(result.CheckoutRequestID || '').trim();
    const merchantRequestId = String(result.MerchantRequestID || '').trim();
    if (!checkoutRequestId || !merchantRequestId) {
      throw new ServiceUnavailableException(
        'M-Pesa accepted the prompt but returned no transaction identifiers.',
      );
    }

    try {
      await this.prisma.mpesaTransaction.create({
        data: {
          merchantRequestId,
          checkoutRequestId,
          phoneNumber: msisdn,
          amount,
          mpesaReceiptNumber: null,
          transactionDate: null,
          resultCode: PENDING_RESULT_CODE,
          resultDesc: 'Awaiting customer PIN entry',
          rawPayload: {
            status: 'PENDING_PIN_PROMPT',
            invoiceId: input.invoiceId,
            invoiceNumber: input.invoiceNumber || null,
            requestedAmount: amount,
            environment: config.environment,
            initiatedAt: new Date().toISOString(),
            darajaResponse: result,
          },
        },
      });
    } catch (err: any) {
      this.logger.error(
        `M-Pesa prompt ${checkoutRequestId} was sent but could not be persisted: ${err?.message || 'database error'}`,
      );
      throw new ServiceUnavailableException(
        `M-Pesa prompt was sent (${checkoutRequestId}) but could not be tracked. Contact support before retrying.`,
      );
    }

    return {
      ResponseCode: '0',
      ResponseDescription: String(
        result.ResponseDescription || 'Success. Request accepted for processing',
      ),
      MerchantRequestID: merchantRequestId,
      CheckoutRequestID: checkoutRequestId,
      CustomerMessage: `STK Push sent to ${msisdn}. Enter your M-Pesa PIN on your phone to pay ${this.formatKes(amount)}.`,
      status: 'PENDING_PIN_PROMPT',
      amountKES: amount,
      phoneNumber: msisdn,
    };
  }

  async handleCallback(payload: any) {
    const stkCallback = payload?.Body?.stkCallback;
    if (!stkCallback) {
      return { ResultCode: 1, ResultDesc: 'Rejected. Malformed payload' };
    }

    const checkoutRequestId = String(stkCallback.CheckoutRequestID || '').trim();
    const resultCode = Number(stkCallback.ResultCode);
    const resultDesc = String(stkCallback.ResultDesc || 'M-Pesa callback received');
    if (!checkoutRequestId || !Number.isFinite(resultCode)) {
      return { ResultCode: 1, ResultDesc: 'Rejected. Missing callback identifiers' };
    }

    const items = Array.isArray(stkCallback.CallbackMetadata?.Item)
      ? stkCallback.CallbackMetadata.Item
      : [];
    const itemValue = (name: string) =>
      items.find((item: any) => String(item?.Name || '').toUpperCase() === name.toUpperCase())
        ?.Value;

    const receipt = itemValue('MpesaReceiptNumber')
      ? String(itemValue('MpesaReceiptNumber'))
      : null;
    const amount = Number(itemValue('Amount') || 0);
    const phone = itemValue('PhoneNumber') ? String(itemValue('PhoneNumber')) : '';
    const transactionDate = this.parseMpesaDate(itemValue('TransactionDate'));

    const existing = this.prisma?.mpesaTransaction?.findUnique
      ? await this.prisma.mpesaTransaction.findUnique({ where: { checkoutRequestId } })
      : null;

    if (!existing) {
      this.logger.warn(`M-Pesa callback received for unknown checkout ${checkoutRequestId}.`);
      try {
        await this.prisma.mpesaTransaction.create({
          data: {
            merchantRequestId: String(stkCallback.MerchantRequestID || 'UNKNOWN'),
            checkoutRequestId,
            phoneNumber: phone || 'N/A',
            amount: Number.isFinite(amount) ? amount : 0,
            mpesaReceiptNumber: receipt,
            transactionDate,
            resultCode,
            resultDesc,
            rawPayload: { status: 'UNMATCHED', callback: payload },
          },
        });
      } catch (err: any) {
        this.logger.warn(`Could not store unmatched M-Pesa callback: ${err?.message || 'database error'}`);
      }
      return { ResultCode: 0, ResultDesc: 'Callback received but not matched', matched: false };
    }

    const existingPayload = existing.rawPayload || existing.raw_payload || {};
    if (existingPayload.status === 'PAID' || existing.paymentId || existing.payment_id) {
      return {
        ResultCode: 0,
        ResultDesc: 'Payment already recorded',
        alreadyProcessed: true,
        receipt: existing.mpesaReceiptNumber || receipt,
      };
    }

    if (resultCode !== 0) {
      await this.prisma.mpesaTransaction.update({
        where: { checkoutRequestId },
        data: {
          resultCode,
          resultDesc,
          rawPayload: {
            ...existingPayload,
            ...payload,
            status: 'FAILED',
            failedAt: new Date().toISOString(),
          },
        },
      });
      return { ResultCode: 0, ResultDesc: 'Failed payment recorded', receipt: null };
    }

    const expectedAmount = Number(existingPayload.requestedAmount || existing.amount || 0);
    if (
      !receipt ||
      !phone ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      Math.round(amount) !== Math.round(expectedAmount) ||
      !existingPayload.invoiceId
    ) {
      await this.prisma.mpesaTransaction.update({
        where: { checkoutRequestId },
        data: {
          resultCode,
          resultDesc,
          amount: Number.isFinite(amount) ? amount : 0,
          mpesaReceiptNumber: receipt,
          phoneNumber: phone || String(existing.phoneNumber || 'N/A'),
          transactionDate,
          rawPayload: {
            ...existingPayload,
            ...payload,
            status: 'INVALID_SUCCESS_CALLBACK',
            failedAt: new Date().toISOString(),
          },
        },
      });
      return {
        ResultCode: 0,
        ResultDesc: 'Success callback could not be verified against the pending request',
        receipt,
      };
    }

    let outcome: MpesaLedgerOutcome;
    try {
      outcome = await this.prisma.$transaction(async (tx: any) => {
        const current = await tx.mpesaTransaction.findUnique({ where: { checkoutRequestId } });
        const currentPayload = current?.rawPayload || current?.raw_payload || {};
        if (!current || currentPayload.status === 'PAID' || current.paymentId || current.payment_id) {
          return { duplicate: true as const };
        }

        const invoice = await tx.invoice.findUnique({ where: { id: currentPayload.invoiceId } });
        if (!invoice) {
          throw new BadRequestException('The invoice linked to this M-Pesa payment no longer exists.');
        }

        const currentPaid = Number(
          this.invoiceValue(invoice, 'paidAmountKES', 'paidAmount', 'paid_amount') || 0,
        );
        const total = Number(
          this.invoiceValue(invoice, 'totalAmountKES', 'totalAmount', 'total_amount') || 0,
        );
        const newPaid = currentPaid + amount;
        const newBalance = Math.max(0, total - newPaid);
        const newStatus =
          newBalance === 0 ? InvoiceStatus.FULLY_PAID : InvoiceStatus.PARTIALLY_PAID;

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmountKES: newPaid,
            balanceKES: newBalance,
            status: newStatus as any,
          },
        });

        const payment = await tx.payment.create({
          data: {
            receiptNumber: this.generateReceiptNumber(),
            invoiceId: invoice.id,
            amountKES: amount,
            paymentMethod: PaymentMethod.MPESA_STK as any,
            transactionRef: receipt,
            receivedBy: 'MPESA_STK_CALLBACK',
            payerPhone: phone,
          },
        });

        await tx.mpesaTransaction.update({
          where: { checkoutRequestId },
          data: {
            paymentId: payment.id,
            resultCode,
            resultDesc,
            amount,
            mpesaReceiptNumber: receipt,
            phoneNumber: phone,
            transactionDate,
            rawPayload: {
              ...currentPayload,
              ...payload,
              status: 'PAID',
              paidAt: new Date().toISOString(),
              paymentId: payment.id,
              mpesaReceiptNumber: receipt,
            },
          },
        });

        return {
          duplicate: false as const,
          payment,
          invoiceId: invoice.id,
          invoiceNumber: this.invoiceNumber(invoice),
          balanceKES: newBalance,
          amountKES: amount,
          notes: invoice.notes,
          patientId: this.invoiceValue(invoice, 'patientId', 'patient_id'),
          phone,
        };
      });
    } catch (err: any) {
      const message = String(err?.message || '');
      if (
        /duplicate key|unique constraint/i.test(message) &&
        /payment_reference|mpesa_receipt_number|checkout_request_id/i.test(message)
      ) {
        return {
          ResultCode: 0,
          ResultDesc: 'Payment already recorded',
          alreadyProcessed: true,
          receipt,
        };
      }
      throw err;
    }

    if (outcome.duplicate) {
      return { ResultCode: 0, ResultDesc: 'Payment already recorded', alreadyProcessed: true, receipt };
    }

    await this.sendPaymentReceipt(outcome);

    return {
      ResultCode: 0,
      ResultDesc: 'Payment recorded successfully',
      receipt,
      paymentId: outcome.payment?.id || null,
      invoiceNumber: outcome.invoiceNumber,
      balanceKES: outcome.balanceKES,
    };
  }

  private async sendPaymentReceipt(context: {
    invoiceId: string;
    invoiceNumber: string;
    amountKES: number;
    balanceKES: number;
    notes: any;
    patientId: string | null;
    phone: string;
  }) {
    try {
      const patient = context.patientId && this.prisma.patient?.findUnique
        ? await this.prisma.patient.findUnique({ where: { id: context.patientId } })
        : null;
      const patientName =
        this.noteValue(context.notes, 'Bill to') ||
        this.patientName(patient) ||
        'Client';

      await this.communication.sendMessage({
        recipient: context.phone,
        channel: CommunicationChannel.SMS,
        templateKey: 'PAYMENT_RECEIPT',
        recipientType: 'PATIENT',
        variables: {
          patient_name: patientName,
          amount_paid: this.formatKes(context.amountKES),
          invoice_number: context.invoiceNumber,
          balance: this.formatKes(context.balanceKES),
          facility: FACILITY_NAME,
          phone: FACILITY_PHONE,
        },
      });
    } catch (err: any) {
      // The payment is already committed; a messaging failure must not make
      // Safaricom retry the callback and create a duplicate payment.
      this.logger.warn(`M-Pesa receipt message was not delivered: ${err?.message || 'unknown error'}`);
    }
  }
}
