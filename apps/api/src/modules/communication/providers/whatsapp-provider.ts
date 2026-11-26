/**
 * WhatsApp provider abstraction.
 *
 * Two implementations are provided:
 *  - `mock`   - no-op driver for local dev/tests.
 *  - `baileys` - unofficial WhatsApp Web client (see baileys-whatsapp.provider.ts).
 *
 * NOTE: Baileys/whatsapp-web.js are unofficial clients and violate WhatsApp's
 * Terms of Service for automated messaging. The account number can be banned.
 * See docs/runbooks/whatsapp-ban-risk.md before enabling in production.
 */

export interface WhatsAppSendInput {
  /** Recipient in E.164, e.g. +254712345678. Drivers convert to their own JID format. */
  to: string;
  body: string;
}

export interface WhatsAppDocumentInput {
  /** Recipient in E.164, e.g. +254712345678. */
  to: string;
  /** PDF bytes (or another document buffer) to deliver as a real attachment. */
  buffer: Buffer | Uint8Array;
  fileName: string;
  caption?: string;
}

export type WhatsAppDeliveryStatus = 'QUEUED' | 'SENT' | 'FAILED';

export interface WhatsAppSendResult {
  provider: string;
  /** WhatsApp message id (Baileys `key.id`), stored as `provider_message_id`. */
  providerMessageId: string | null;
  status: WhatsAppDeliveryStatus;
  /** WhatsApp has no per-message cost; always 0. */
  costKes: number;
  raw?: unknown;
}

export interface WhatsAppProvider {
  readonly name: string;
  send(input: WhatsAppSendInput): Promise<WhatsAppSendResult>;
  /** Optional: drivers that support attachments can deliver PDFs (e.g. invoices). */
  sendDocument?(input: WhatsAppDocumentInput): Promise<WhatsAppSendResult>;
}

/**
 * Convert E.164 (+254712345678) to a WhatsApp JID (254712345678@s.whatsapp.net).
 * WhatsApp JIDs never contain the leading '+' or any punctuation.
 */
export function toWhatsAppJid(e164: string): string {
  const digits = (e164 || '').replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}
