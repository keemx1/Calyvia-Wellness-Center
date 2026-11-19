import { Logger } from '@nestjs/common';
import {
  WhatsAppProvider,
  WhatsAppSendInput,
  WhatsAppSendResult,
  toWhatsAppJid,
} from './whatsapp-provider';

/**
 * No-op WhatsApp driver for local development and tests.
 * Selected when `WHATSAPP_PROVIDER=mock`.
 */
export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'mock';
  private readonly logger = new Logger('MockWhatsAppProvider');

  async send(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    const jid = toWhatsAppJid(input.to);
    this.logger.log(`[MOCK WHATSAPP] jid=${jid} body="${input.body.slice(0, 60)}${input.body.length > 60 ? '…' : ''}"`);

    return {
      provider: this.name,
      providerMessageId: `MOCK-WA-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      status: 'SENT',
      costKes: 0,
      raw: { mocked: true, jid },
    };
  }
}
