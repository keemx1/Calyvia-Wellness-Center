/**
 * SMS provider abstraction.
 *
 * Per ADR-001 the gateway layer stays provider-agnostic so another aggregator can
 * be added without touching business logic. ByteWave is the production driver;
 * `mock` exists for local development and tests. Every driver implements this contract.
 */

export interface SmsSendInput {
  /** Recipient in E.164 form, e.g. +254712345678 */
  to: string;
  /** Message body (GSM-7 or UCS-2; drivers must not silently truncate). */
  body: string;
  /** Registered sender ID / shortcode. Falls back to the driver's default. */
  senderId?: string;
}

export type SmsDeliveryStatus = 'QUEUED' | 'SENT' | 'FAILED';

export interface SmsSendResult {
  /** Which driver produced this result, e.g. 'bytewave', 'mock'. */
  provider: string;
  /** Gateway-assigned message id, stored as `provider_message_id`. */
  providerMessageId: string | null;
  status: SmsDeliveryStatus;
  /** Cost of this message in KES, used for the `cost_kes` column. */
  costKes: number;
  /** Untouched gateway response, useful for audit/debugging. */
  raw?: unknown;
}

export interface SmsProvider {
  readonly name: string;
  send(input: SmsSendInput): Promise<SmsSendResult>;
}

/** Rough SMS segment count: GSM-7 = 160/153, UCS-2 = 70/67. */
export function countSmsSegments(body: string): number {
  // Anything outside 7-bit ASCII forces UCS-2 encoding, which halves the segment size.
  const isUcs2 = Array.from(body).some((ch) => (ch.codePointAt(0) ?? 0) > 0x7f);
  const single = isUcs2 ? 70 : 160;
  const multi = isUcs2 ? 67 : 153;
  return body.length <= single ? 1 : Math.ceil(body.length / multi);
}
