import { Logger } from '@nestjs/common';
import { SmsProvider, SmsSendInput, SmsSendResult, countSmsSegments } from './sms-provider';

/**
 * ByteWave Networks bulk SMS driver (https://portal.bytewavenetworks.com).
 *
 * ⚠️ SPEC NOT YET CONFIRMED
 * ByteWave publishes no public API documentation — the endpoint, auth scheme and
 * field names live behind the login at portal.bytewavenetworks.com (API/Developers
 * menu). Until their spec is pasted in, the request shape is fully configurable via
 * environment variables so the only code change needed is adjusting these defaults.
 *
 * Config (all optional except the first two):
 *   BYTEWAVE_API_URL        Full endpoint URL. Enables this driver.
 *   BYTEWAVE_API_KEY        API key / token issued in the portal.
 *   BYTEWAVE_SENDER_ID      Registered sender ID or shortcode (default CALYVIA).
 *   BYTEWAVE_AUTH_STYLE     query | bearer | header   (default query)
 *   BYTEWAVE_KEY_PARAM      Param name when AUTH_STYLE=query   (default apikey)
 *   BYTEWAVE_KEY_HEADER     Header name when AUTH_STYLE=header (default Authorization)
 *   BYTEWAVE_BODY_STYLE     json | form | query        (default json)
 *   BYTEWAVE_PARAM_TO       Recipient field name (default mobile)
 *   BYTEWAVE_PARAM_MESSAGE  Message field name  (default message)
 *   BYTEWAVE_PARAM_SENDER   Sender field name   (default sender)
 *   BYTEWAVE_ID_FIELD       Response field holding the gateway message id (default id)
 *
 * Kenyan panels in this class commonly accept a query-string API such as
 *   GET  /api?apikey=KEY&sender=CALYVIA&mobile=254712345678&message=Hello
 * which is why `query` auth + `query` body are supported alongside JSON POST.
 */

interface ByteWaveConfig {
  apiUrl: string;
  apiKey: string;
  senderId: string;
  authStyle: 'query' | 'bearer' | 'header';
  keyParam: string;
  keyHeader: string;
  bodyStyle: 'json' | 'form' | 'query';
  paramTo: string;
  paramMessage: string;
  paramSender: string;
  idField: string;
}

function loadConfig(): ByteWaveConfig | null {
  const apiUrl = process.env.BYTEWAVE_API_URL?.trim();
  const apiKey = process.env.BYTEWAVE_API_KEY?.trim();
  if (!apiUrl || !apiKey) return null;

  const authStyle = (process.env.BYTEWAVE_AUTH_STYLE || 'query').toLowerCase();
  const bodyStyle = (process.env.BYTEWAVE_BODY_STYLE || 'json').toLowerCase();

  return {
    apiUrl,
    apiKey,
    senderId: process.env.BYTEWAVE_SENDER_ID || 'CALYVIA',
    authStyle: (['query', 'bearer', 'header'].includes(authStyle) ? authStyle : 'query') as ByteWaveConfig['authStyle'],
    keyParam: process.env.BYTEWAVE_KEY_PARAM || 'apikey',
    keyHeader: process.env.BYTEWAVE_KEY_HEADER || 'Authorization',
    bodyStyle: (['json', 'form', 'query'].includes(bodyStyle) ? bodyStyle : 'json') as ByteWaveConfig['bodyStyle'],
    paramTo: process.env.BYTEWAVE_PARAM_TO || 'mobile',
    paramMessage: process.env.BYTEWAVE_PARAM_MESSAGE || 'message',
    paramSender: process.env.BYTEWAVE_PARAM_SENDER || 'sender',
    idField: process.env.BYTEWAVE_ID_FIELD || 'id',
  };
}

export class ByteWaveSmsProvider implements SmsProvider {
  readonly name = 'bytewave';
  private readonly logger = new Logger('ByteWaveSmsProvider');
  private readonly config: ByteWaveConfig;

  constructor() {
    const cfg = loadConfig();
    if (!cfg) {
      throw new Error(
        'ByteWaveSmsProvider requires BYTEWAVE_API_URL and BYTEWAVE_API_KEY. ' +
          'Set them in .env or select a different SMS_PROVIDER.',
      );
    }
    this.config = cfg;
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const { apiUrl, apiKey, senderId, authStyle, keyParam, keyHeader, bodyStyle } = this.config;

    // ByteWave/Kenyan gateways typically want MSISDN without the '+' (e.g. 254712345678).
    const msisdn = input.to.replace(/\D/g, '');
    const sender = input.senderId || senderId;

    const fields: Record<string, string> = {
      [this.config.paramTo]: msisdn,
      [this.config.paramMessage]: input.body,
      [this.config.paramSender]: sender,
    };

    // Query-string auth (key travels in the URL).
    const url = new URL(apiUrl);
    if (authStyle === 'query') url.searchParams.set(keyParam, apiKey);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (authStyle === 'bearer') headers[keyHeader] = `Bearer ${apiKey}`;
    if (authStyle === 'header') headers[keyHeader] = apiKey;

    let body: string | undefined;
    if (bodyStyle === 'json') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(fields);
    } else if (bodyStyle === 'form') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(fields).toString();
    } else {
      // Everything in the query string.
      for (const [k, v] of Object.entries(fields)) url.searchParams.set(k, v);
    }

    const segments = countSmsSegments(input.body);
    this.logger.debug(`Dispatching SMS to ${msisdn} via ByteWave (${segments} segment(s))`);

    const res = await fetch(url.toString(), {
      method: bodyStyle === 'query' ? 'GET' : 'POST',
      headers,
      body,
    });

    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    if (!res.ok) {
      this.logger.error(`ByteWave rejected message (${res.status}): ${text.slice(0, 300)}`);
      return {
        provider: this.name,
        providerMessageId: null,
        status: 'FAILED',
        costKes: 0,
        raw: parsed,
      };
    }

    return {
      provider: this.name,
      providerMessageId: this.extractMessageId(parsed),
      status: 'SENT',
      // Unit price advertised at Ksh 0.25/SMS.
      costKes: Number((segments * 0.25).toFixed(2)),
      raw: parsed,
    };
  }

  /** Gateways disagree on where the message id lives; try the common shapes. */
  private extractMessageId(res: any): string | null {
    if (!res || typeof res !== 'object') return null;
    const candidates = [
      res[this.config.idField],
      res.messageId,
      res.message_id,
      res.smsid,
      res.sms_id,
      res.id,
      res?.data?.id,
      res?.data?.messageId,
      res?.messages?.[0]?.id,
      res?.results?.[0]?.id,
    ];
    const found = candidates.find((v) => v !== undefined && v !== null && v !== '');
    return found !== undefined ? String(found) : null;
  }
}
