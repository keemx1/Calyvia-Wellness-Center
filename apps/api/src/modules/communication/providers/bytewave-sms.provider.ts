import { Logger } from '@nestjs/common';
import { SmsProvider, SmsSendInput, SmsSendResult, countSmsSegments } from './sms-provider';
import { ConfigResolver } from './config-resolver';

/**
 * ByteWave Networks bulk SMS driver (https://portal.bytewavenetworks.com).
 *
 * ⚠️ SPEC NOT YET CONFIRMED
 * ByteWave publishes no public API documentation — the endpoint, auth scheme and
 * field names live behind the login at portal.bytewavenetworks.com (API/Developers
 * menu). Until their spec is pasted in, the request shape is fully configurable so
 * the only change needed is adjusting these names.
 *
 * Config is resolved per send via `ConfigResolver`: the deployment environment wins,
 * `system_settings` (admin UI) is the fallback. That is what lets an operator rotate
 * the API key without a redeploy.
 *
 * Setting key                          Env var              Default
 *   gateway.sms.bytewave.api_url       BYTEWAVE_API_URL     (required)
 *   gateway.sms.bytewave.api_key       BYTEWAVE_API_KEY     (required)
 *   gateway.sms.bytewave.sender_id     BYTEWAVE_SENDER_ID   CALYVIA
 *   -                                  BYTEWAVE_AUTH_STYLE  query | bearer | header
 *   -                                  BYTEWAVE_KEY_PARAM   apikey
 *   -                                  BYTEWAVE_KEY_HEADER  Authorization
 *   -                                  BYTEWAVE_BODY_STYLE  json | form | query
 *   -                                  BYTEWAVE_PARAM_TO    mobile
 *   -                                  BYTEWAVE_PARAM_MESSAGE message
 *   -                                  BYTEWAVE_PARAM_SENDER  sender
 *   -                                  BYTEWAVE_ID_FIELD      id
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

function pick(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function pickEnum<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  const v = (value || '').toLowerCase().trim();
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export class ByteWaveSmsProvider implements SmsProvider {
  readonly name = 'bytewave';
  private readonly logger = new Logger('ByteWaveSmsProvider');

  constructor(private readonly config: ConfigResolver) {}

  private async loadConfig(): Promise<ByteWaveConfig> {
    const apiUrl = await this.config.get('BYTEWAVE_API_URL', 'gateway.sms.bytewave.api_url');
    const apiKey = await this.config.get('BYTEWAVE_API_KEY', 'gateway.sms.bytewave.api_key');

    if (!apiUrl || !apiKey) {
      throw new Error(
        'ByteWave is not configured. Set BYTEWAVE_API_URL and BYTEWAVE_API_KEY in the ' +
          'deployment environment, or in System Settings (gateway.sms.bytewave.*).',
      );
    }

    return {
      apiUrl,
      apiKey,
      senderId: pick(
        await this.config.get('BYTEWAVE_SENDER_ID', 'gateway.sms.bytewave.sender_id'),
        'CALYVIA',
      ),
      authStyle: pickEnum(process.env.BYTEWAVE_AUTH_STYLE, ['query', 'bearer', 'header'] as const, 'query'),
      keyParam: pick(process.env.BYTEWAVE_KEY_PARAM, 'apikey'),
      keyHeader: pick(process.env.BYTEWAVE_KEY_HEADER, 'Authorization'),
      bodyStyle: pickEnum(process.env.BYTEWAVE_BODY_STYLE, ['json', 'form', 'query'] as const, 'json'),
      paramTo: pick(process.env.BYTEWAVE_PARAM_TO, 'mobile'),
      paramMessage: pick(process.env.BYTEWAVE_PARAM_MESSAGE, 'message'),
      paramSender: pick(process.env.BYTEWAVE_PARAM_SENDER, 'sender'),
      idField: pick(process.env.BYTEWAVE_ID_FIELD, 'id'),
    };
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const cfg = await this.loadConfig();
    const { apiUrl, apiKey, senderId, authStyle, keyParam, keyHeader, bodyStyle } = cfg;

    // ByteWave/Kenyan gateways typically want MSISDN without the '+' (e.g. 254712345678).
    const msisdn = input.to.replace(/\D/g, '');
    const sender = input.senderId || senderId;

    const fields: Record<string, string> = {
      [cfg.paramTo]: msisdn,
      [cfg.paramMessage]: input.body,
      [cfg.paramSender]: sender,
    };

    // Query-string auth (the key travels in the URL).
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
      providerMessageId: this.extractMessageId(parsed, cfg.idField),
      status: 'SENT',
      // Unit price advertised at Ksh 0.25/SMS.
      costKes: Number((segments * 0.25).toFixed(2)),
      raw: parsed,
    };
  }

  /** Gateways disagree on where the message id lives; try the common shapes. */
  private extractMessageId(res: any, idField: string): string | null {
    if (!res || typeof res !== 'object') return null;
    const candidates = [
      res[idField],
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
