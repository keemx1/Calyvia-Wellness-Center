import { Logger } from '@nestjs/common';
import { SmsProvider, SmsSendInput, SmsSendResult } from './sms-provider';
import { ConfigResolver } from './config-resolver';

/**
 * Africa's Talking SMS driver (https://africastalking.com).
 * Plain REST — no SDK dependency. Selected when `SMS_PROVIDER=africas_talking`.
 *
 * Config is resolved per send via `ConfigResolver` (deployment env wins,
 * `system_settings` is the fallback):
 *
 *   gateway.sms.africastalking.username    AFRICASTALKING_USERNAME   (required)
 *   gateway.sms.africastalking.api_key     AFRICASTALKING_API_KEY    (required)
 *   gateway.sms.africastalking.sender_id   AFRICASTALKING_SENDER_ID
 *   -                                      AFRICASTALKING_ENV        production | sandbox
 */
export class AfricasTalkingSmsProvider implements SmsProvider {
  readonly name = 'africas_talking';
  private readonly logger = new Logger('AfricasTalkingSmsProvider');

  constructor(private readonly config: ConfigResolver) {}

  private async loadConfig() {
    const username = await this.config.get(
      'AFRICASTALKING_USERNAME',
      'gateway.sms.africastalking.username',
    );
    const apiKey = await this.config.get('AFRICASTALKING_API_KEY', 'gateway.sms.africastalking.api_key');

    if (!username || !apiKey) {
      throw new Error(
        "Africa's Talking is not configured. Set AFRICASTALKING_USERNAME and " +
          'AFRICASTALKING_API_KEY in the deployment environment, or in System Settings ' +
          '(gateway.sms.africastalking.*).',
      );
    }

    const senderId = await this.config.get(
      'AFRICASTALKING_SENDER_ID',
      'gateway.sms.africastalking.sender_id',
    );

    // The "sandbox" username implies the sandbox host.
    const isSandbox =
      (process.env.AFRICASTALKING_ENV || '').toLowerCase() === 'sandbox' ||
      username.toLowerCase() === 'sandbox';

    return {
      username,
      apiKey,
      senderId: senderId || undefined,
      baseUrl: isSandbox
        ? 'https://api.sandbox.africastalking.com'
        : 'https://api.africastalking.com',
    };
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const cfg = await this.loadConfig();

    // Africa's Talking accepts E.164 (+254712345678) or 254712345678.
    const to = input.to.startsWith('+') ? input.to : `+${input.to.replace(/\D/g, '')}`;

    const params = new URLSearchParams({
      username: cfg.username,
      to,
      message: input.body,
      bulkSMSMode: '1',
    });
    const sender = input.senderId || cfg.senderId;
    if (sender) params.set('from', sender);

    const res = await fetch(`${cfg.baseUrl}/version1/messaging`, {
      method: 'POST',
      headers: {
        apiKey: cfg.apiKey,
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
