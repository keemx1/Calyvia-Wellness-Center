import { Logger } from '@nestjs/common';
import { SmsProvider, SmsSendInput, SmsSendResult } from './sms-provider';

/**
 * Africa's Talking SMS driver (https://africastalking.com).
 * Plain REST — no SDK dependency. Chosen as the documented fallback aggregator
 * in architecture.md; selected when `SMS_PROVIDER=africas_talking`.
 *
 * Config:
 *   AFRICASTALKING_USERNAME   'sandbox' while testing, your app username in production.
 *   AFRICASTALKING_API_KEY    API key from the dashboard.
 *   AFRICASTALKING_SENDER_ID  Registered sender ID / shortcode (optional).
 *   AFRICASTALKING_ENV        sandbox | production  (default production).
 */
export class AfricasTalkingSmsProvider implements SmsProvider {
  readonly name = 'africas_talking';
  private readonly logger = new Logger('AfricasTalkingSmsProvider');

  private readonly username: string;
  private readonly apiKey: string;
  private readonly senderId?: string;
  private readonly baseUrl: string;

  constructor() {
    this.username = process.env.AFRICASTALKING_USERNAME || '';
    this.apiKey = process.env.AFRICASTALKING_API_KEY || '';
    this.senderId = process.env.AFRICASTALKING_SENDER_ID || undefined;

    const isSandbox = (process.env.AFRICASTALKING_ENV || '').toLowerCase() === 'sandbox'
      || this.username.toLowerCase() === 'sandbox';
    this.baseUrl = isSandbox
      ? 'https://api.sandbox.africastalking.com'
      : 'https://api.africastalking.com';

    if (!this.username || !this.apiKey) {
      throw new Error(
        'AfricasTalkingSmsProvider requires AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY.',
      );
    }
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    // Africa's Talking accepts E.164 (+254712345678) or 254712345678.
    const to = input.to.startsWith('+') ? input.to : `+${input.to.replace(/\D/g, '')}`;

    const params = new URLSearchParams({
      username: this.username,
      to,
      message: input.body,
      bulkSMSMode: '1',
    });
    const sender = input.senderId || this.senderId;
    if (sender) params.set('from', sender);

    const res = await fetch(`${this.baseUrl}/version1/messaging`, {
      method: 'POST',
      headers: {
        apiKey: this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    if (!res.ok) {
      this.logger.error(`Africa's Talking rejected message (${res.status}): ${text.slice(0, 300)}`);
      return { provider: this.name, providerMessageId: null, status: 'FAILED', costKes: 0, raw: parsed };
    }

    const recipient = parsed?.SMSMessageData?.Recipients?.[0];
    const ok = recipient?.statusCode === 100;

    return {
      provider: this.name,
      providerMessageId: recipient?.messageId ? String(recipient.messageId) : null,
      status: ok ? 'SENT' : 'FAILED',
      costKes: this.parseCost(recipient?.cost),
      raw: parsed,
    };
  }

  /** Cost arrives as "KES 0.8000". */
  private parseCost(cost: unknown): number {
    if (typeof cost !== 'string') return 0;
    const n = Number.parseFloat(cost.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
  }
}
