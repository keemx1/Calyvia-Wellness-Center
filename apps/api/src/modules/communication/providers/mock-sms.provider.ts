import { Logger } from '@nestjs/common';
import { SmsProvider, SmsSendInput, SmsSendResult, countSmsSegments } from './sms-provider';

/**
 * No-op SMS driver for local development and tests.
 * Never leaves the machine: it records what *would* have been sent and returns a
 * synthetic gateway reference. Selected when `SMS_PROVIDER=mock`.
 */
export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock';
  private readonly logger = new Logger('MockSmsProvider');

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const segments = countSmsSegments(input.body);
    this.logger.log(
      `[MOCK SMS] to=${input.to} segments=${segments} sender=${input.senderId ?? 'CALYVIA'} body="${input.body.slice(0, 60)}${input.body.length > 60 ? '…' : ''}"`,
    );

    return {
      provider: this.name,
      providerMessageId: `MOCK-SMS-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      status: 'SENT',
      // Ksh 0.25 is the ByteWave unit price; mock uses it so cost reporting looks realistic.
      costKes: Number((segments * 0.25).toFixed(2)),
      raw: { mocked: true, segments },
    };
  }
}
