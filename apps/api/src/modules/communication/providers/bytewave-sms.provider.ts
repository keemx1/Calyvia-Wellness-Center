import { Logger } from '@nestjs/common';
import { SmsProvider, SmsSendInput, SmsSendResult, countSmsSegments } from './sms-provider';
import { ConfigResolver } from './config-resolver';

/**
 * ByteWave Networks bulk SMS driver (https://portal.bytewavenetworks.com).
 *
 * The portal exposes two APIs (API / Developers menu):
 *   HTTP API    https://portal.bytewavenetworks.com/api/http/   (simple key, GET/POST)
 *   OAuth 2.0   https://portal.bytewavenetworks.com/api/v3/     (client credentials -> Bearer)
 *
 * Config is resolved per send via `ConfigResolver`: the deployment environment wins,
 * `system_settings` (admin UI) is the fallback. That is what lets an operator rotate
 * the API key without a redeploy.
 *
 * Setting key                          Env var                  Default
 *   gateway.sms.bytewave.mode          BYTEWAVE_API_MODE        http | oauth2 (default http)
 *   gateway.sms.bytewave.api_url       BYTEWAVE_API_URL        (http default .../api/http/, oauth2 .../api/v3/)
 *   gateway.sms.bytewave.api_key       BYTEWAVE_API_KEY        (required for http mode)
 *   gateway.sms.bytewave.client_id     BYTEWAVE_CLIENT_ID      (oauth2; or parsed from api_key)
 *   gateway.sms.bytewave.client_secret BYTEWAVE_CLIENT_SECRET  (oauth2, encrypted; or parsed from api_key)
 *   gateway.sms.bytewave.sender_id     BYTEWAVE_SENDER_ID      CALYVIA
 * Wire field names (fixed, not env-overridable): api_token, recipient, message, sender_id.
 * The legacy BYTEWAVE_KEY_PARAM / PARAM_* env vars are deliberately ignored.
 *   -                                  BYTEWAVE_ID_FIELD        id
 *
 * OAuth key convenience: when mode is oauth2 and client id/secret are not set
 * separately, a combined key of the form `oc_sk_<clientId>_<clientSecret>` is split
 * automatically (the portal issues keys that look like this).
 */

export type ByteWaveMode = 'http' | 'oauth2';

interface ByteWaveConfig {
  mode: ByteWaveMode;
  apiUrl: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  senderId: string;
  keyParam: string;
  paramTo: string;
  paramMessage: string;
  paramSender: string;
  idField: string;
}

export const BYTEWAVE_HTTP_BASE = 'https://portal.bytewavenetworks.com/api/http/';
export const BYTEWAVE_OAUTH_BASE = 'https://portal.bytewavenetworks.com/api/v3/';

/**
 * Price per SMS segment. ByteWave's balance API reports only a KES credit, not
 * an SMS count, so the same rate powers the "SMS available" estimate. Override
 * with BYTEWAVE_SMS_COST_KES if your account's rate differs.
 */
export function byteWaveCostPerSms(): number {
  const value = Number(process.env.BYTEWAVE_SMS_COST_KES);
  return Number.isFinite(value) && value > 0 ? value : 0.25;
}

function pick(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

/** Fix the `coma/api` typo that appears when the endpoint is copied from the portal UI. */
export function sanitizeByteWaveUrl(raw: string): string {
  return (raw || '').trim().replace(/coma\/api\//i, 'com/api/');
}

function joinUrl(base: string, ...parts: string[]): string {
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return parts.reduce((acc, p) => {
    const left = acc.endsWith('/') ? acc : `${acc}/`;
    const right = p.startsWith('/') ? p.slice(1) : p;
    return left + right;
  }, cleanBase);
}

/**
 * Split a combined portal key (`oc_sk_<clientId>_<clientSecret>`) into its parts.
 * Returns null when the value is a plain HTTP API key.
 */
export function splitCombinedKey(apiKey: string): { clientId: string; clientSecret: string } | null {
  const v = (apiKey || '').trim();
  const m = v.match(/^oc_sk_([^_]+)_(.+)$/);
  if (!m) return null;
  return { clientId: m[1], clientSecret: m[2] };
}

export interface ByteWaveBalanceView {
  /** Account credit in KES, when the portal reports a monetary balance. */
  balanceKes: number | null;
  /** Number of SMS units left, when the portal reports it. */
  smsAvailable: number | null;
  /** Raw nested values that looked like a balance, for the UI fallback. */
  candidates: Array<{ key: string; value: string }>;
}

const BALANCE_KEYS = [
  // Confirmed from the live portal: data.remaining_balance = "Ksh50.40".
  'remaining_balance',
  'remainingbalance',
  'balance_remaining',
  'balanceremaining',
  'balance',
  'account_balance',
  'accountbalance',
  'wallet_balance',
  'walletbalance',
  'credit_balance',
  'creditbalance',
  'current_balance',
  'currentbalance',
  'credits',
  'amount',
];
const SMS_KEYS = [
  'sms_balance',
  'smsbalance',
  'sms_available',
  'smsavailable',
  'sms_credits',
  'smscredits',
  'messages_remaining',
  'messagesremaining',
  'remaining_sms',
  'remainingsms',
  'sms_count',
  'smscount',
  'sms_remaining',
  'smsremaining',
  'available_sms',
  'availablesms',
  'sms_left',
  'smsleft',
  'sms_units',
  'smsunits',
  'units',
];

/** Flatten nested portal JSON into lowercase key -> values (arrays ignored). */
function balanceFields(raw: any, depth = 0, acc: Record<string, any[]> = {}): Record<string, any[]> {
  if (!raw || typeof raw !== 'object' || depth > 3) return acc;
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined || Array.isArray(value)) continue;
    const k = key.toLowerCase();
    if (typeof value === 'object') balanceFields(value, depth + 1, acc);
    else (acc[k] ||= []).push(value);
  }
  return acc;
}

function numeric(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return null;
}

/**
 * ByteWave's balance payload differs between accounts (`data.balance`,
 * `data.sms_balance`, nested plan/wallet objects, strings like "KES 120.50").
 * Pull out the useful numbers without assuming one fixed schema.
 */
export function parseByteWaveBalance(raw: any): ByteWaveBalanceView {
  const fields = balanceFields(raw);
  const pick = (keys: string[]): number | null => {
    for (const key of keys) {
      for (const value of fields[key] ?? []) {
        const n = numeric(value);
        if (n !== null) return n;
      }
    }
    return null;
  };

  const candidates = Object.entries(fields)
    .filter(([key]) => [...BALANCE_KEYS, ...SMS_KEYS].some((k) => k === key))
    .flatMap(([key, values]) => values.map((value) => ({ key, value: String(value) })))
    .slice(0, 8);

  return {
    balanceKes: pick(BALANCE_KEYS),
    smsAvailable: pick(SMS_KEYS),
    candidates,
  };
}

export class ByteWaveSmsProvider implements SmsProvider {
  readonly name = 'bytewave';
  private readonly logger = new Logger('ByteWaveSmsProvider');

  /** Cached OAuth2 bearer token (per provider instance). */
  private oauthToken: string | null = null;
  private oauthExpiresAt = 0;

  constructor(private readonly config: ConfigResolver) {}

  private async loadConfig(): Promise<ByteWaveConfig> {
    const rawMode = (
      process.env.BYTEWAVE_API_MODE ||
      (await this.config.get('BYTEWAVE_API_MODE', 'gateway.sms.bytewave.mode')) ||
      'http'
    )
      .toLowerCase()
      .trim();
    const mode: ByteWaveMode = rawMode === 'oauth2' ? 'oauth2' : 'http';

    const defaultBase = mode === 'oauth2' ? BYTEWAVE_OAUTH_BASE : BYTEWAVE_HTTP_BASE;
    const apiUrl = sanitizeByteWaveUrl(
      pick(await this.config.get('BYTEWAVE_API_URL', 'gateway.sms.bytewave.api_url'), defaultBase),
    );
    const apiKey =
      (await this.config.get('BYTEWAVE_API_KEY', 'gateway.sms.bytewave.api_key')) || '';
    let clientId =
      process.env.BYTEWAVE_CLIENT_ID ||
      (await this.config.get('BYTEWAVE_CLIENT_ID', 'gateway.sms.bytewave.client_id')) ||
      '';
    let clientSecret =
      process.env.BYTEWAVE_CLIENT_SECRET ||
      (await this.config.get('BYTEWAVE_CLIENT_SECRET', 'gateway.sms.bytewave.client_secret')) ||
      '';

    // Convenience: the portal issues a single `oc_sk_<id>_<secret>` value.
    if (mode === 'oauth2' && (!clientId || !clientSecret) && apiKey) {
      const split = splitCombinedKey(apiKey);
      if (split) {
        clientId = clientId || split.clientId;
        clientSecret = clientSecret || split.clientSecret;
      }
    }

    if (mode === 'http' && !apiKey) {
      throw new Error(
        'ByteWave is not configured. Set BYTEWAVE_API_KEY in the deployment environment, ' +
          'or in System Settings (gateway.sms.bytewave.api_key).',
      );
    }
    if (mode === 'oauth2' && (!clientId || !clientSecret)) {
      throw new Error(
        'ByteWave OAuth2 is not configured. Set BYTEWAVE_CLIENT_ID and BYTEWAVE_CLIENT_SECRET ' +
          '(or paste the combined oc_sk_ key as BYTEWAVE_API_KEY), or in System Settings ' +
          '(gateway.sms.bytewave.client_*).',
      );
    }

    return {
      mode,
      apiUrl,
      apiKey,
      clientId,
      clientSecret,
      senderId: pick(
        await this.config.get('BYTEWAVE_SENDER_ID', 'gateway.sms.bytewave.sender_id'),
        'CALYVIA',
      ),
      // Wire-format field names are fixed by the portal. They used to be env
      // configurable, but stale deployments carried the old `recipients`/`apiKey`
      // values and silently broke every send. Never let an override win here.
      keyParam: 'api_token',
      paramTo: 'recipient',
      paramMessage: 'message',
      paramSender: 'sender_id',
      idField: pick(process.env.BYTEWAVE_ID_FIELD, 'id'),
    };
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const cfg = await this.loadConfig();
    return cfg.mode === 'oauth2' ? this.sendViaOAuth(cfg, input) : this.sendViaHttp(cfg, input);
  }

  /**
   * Read the account balance from ByteWave. The portal exposes
   * GET /api/http/balance?api_token=... for plain HTTP keys and
   * GET /api/v3/balance for bearer-authenticated accounts. We try both shapes
   * because the exact response fields differ between accounts; the raw payload
   * is returned so the UI can show whatever the portal reports.
   */
  async getBalance(): Promise<{ status: 'OK' | 'FAILED'; raw: any }> {
    const cfg = await this.loadConfig();
    const attempts: Array<{ url: string; headers: Record<string, string> }> = [];

    if (cfg.mode === 'http') {
      for (const suffix of ['balance', 'sms/balance']) {
        const u = new URL(joinUrl(cfg.apiUrl, suffix));
        u.searchParams.set(cfg.keyParam, cfg.apiKey);
        attempts.push({ url: u.toString(), headers: { Accept: 'application/json' } });
      }
    } else {
      const token = await this.fetchOAuthToken(cfg);
      for (const suffix of ['balance', 'sms/balance']) {
        attempts.push({
          url: joinUrl(cfg.apiUrl, suffix),
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        });
      }
    }

    let lastError = 'ByteWave did not return a balance.';
    let merged: any = null;
    for (const attempt of attempts) {
      try {
        const res = await fetch(attempt.url, { headers: attempt.headers });
        const text = await res.text();
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { raw: text };
        }
        if (res.ok && parsed && parsed.status !== 'error' && !parsed.error) {
          // /balance reports wallet credit, /sms/balance may report the SMS unit
          // count. Merge both `data` objects; the first successful route wins on
          // conflicts so the primary balance is never overwritten.
          if (!merged) {
            merged = parsed;
          } else if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            const priorData = merged?.data;
            const nextData = parsed.data;
            merged = {
              ...merged,
              ...parsed,
              ...(priorData &&
              typeof priorData === 'object' &&
              nextData &&
              typeof nextData === 'object'
                ? { data: { ...nextData, ...priorData } }
                : {}),
            };
          }
          continue;
        }
        lastError = `${attempt.url.split('?')[0]} -> ${text.slice(0, 160)}`;
      } catch (err: any) {
        lastError = `${attempt.url.split('?')[0]} failed: ${err?.message || err}`;
      }
    }
    if (merged) return { status: 'OK', raw: merged };
    throw new Error(lastError);
  }

  // ---------------------------------------------------------------- HTTP API --

  private httpSendUrl(base: string): string {
    // Verified against the live portal: the HTTP send route is .../api/http/sms/send.
    // (An earlier build appended /send and ByteWave replied "route could not be found".)
    if (/\/sms\/send\/?(\?.*)?$/i.test(base)) return base;
    if (/\/send\/?(\?.*)?$/i.test(base)) return base.replace(/\/send\/?(\?.*)?$/i, '/sms/send$1');
    return joinUrl(base, 'sms/send');
  }

  private async sendViaHttp(cfg: ByteWaveConfig, input: SmsSendInput): Promise<SmsSendResult> {
    // ByteWave/Kenyan gateways want MSISDN without the '+' (e.g. 254712345678).
    const msisdn = input.to.replace(/\D/g, '');
    const sender = input.senderId || cfg.senderId;
    const segments = countSmsSegments(input.body);

    const url = new URL(this.httpSendUrl(cfg.apiUrl));
    url.searchParams.set(cfg.keyParam, cfg.apiKey);
    url.searchParams.set(cfg.paramSender, sender);
    // Some ByteWave accounts expect `sender` while others use `sender_id`.
    // Sending both is harmless and avoids a provider-side validation failure.
    if (cfg.paramSender !== 'sender') url.searchParams.set('sender', sender);
    if (cfg.paramSender !== 'sender_id') url.searchParams.set('sender_id', sender);
    url.searchParams.set(cfg.paramTo, msisdn);
    url.searchParams.set(cfg.paramMessage, input.body);

    this.logger.debug(`Dispatching SMS to ${msisdn} via ByteWave HTTP (${segments} segment(s))`);

    let res: Response;
    try {
      // GET with query string: the most widely compatible shape for HTTP SMS APIs.
      res = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
    } catch (err: any) {
      this.logger.error(`ByteWave HTTP request failed: ${err?.message || err}`);
      return { provider: this.name, providerMessageId: null, status: 'FAILED', costKes: 0, raw: { error: String(err?.message || err) } };
    }

    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    if (!res.ok || parsed?.success === false || parsed?.status === 'failed' || parsed?.status === 'error') {
      this.logger.error(`ByteWave rejected message (${res.status}): ${text.slice(0, 300)}`);
      return { provider: this.name, providerMessageId: null, status: 'FAILED', costKes: 0, raw: parsed };
    }

    return {
      provider: this.name,
      providerMessageId: this.extractMessageId(parsed, cfg.idField),
      status: 'SENT',
      // Unit price advertised at Ksh 0.25/SMS.
      costKes: Number((segments * byteWaveCostPerSms()).toFixed(2)),
      raw: parsed,
    };
  }

  // -------------------------------------------------------------- OAuth2 API --

  private async fetchOAuthToken(cfg: ByteWaveConfig): Promise<string> {
    if (this.oauthToken && Date.now() < this.oauthExpiresAt - 60_000) return this.oauthToken;

    const attempts = [
      { url: joinUrl(cfg.apiUrl, 'oauth/token'), body: { grant_type: 'client_credentials', client_id: cfg.clientId, client_secret: cfg.clientSecret } },
      { url: joinUrl(cfg.apiUrl, 'token'), body: { grant_type: 'client_credentials', client_id: cfg.clientId, client_secret: cfg.clientSecret } },
    ];

    let lastError = '';
    for (const attempt of attempts) {
      try {
        const res = await fetch(attempt.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(attempt.body),
        });
        const text = await res.text();
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { raw: text };
        }
        const token = parsed?.access_token || parsed?.accessToken || parsed?.data?.access_token || parsed?.token;
        if (res.ok && token) {
          const expiresIn = Number(parsed?.expires_in ?? parsed?.expiresIn ?? 3600);
          this.oauthToken = String(token);
          this.oauthExpiresAt = Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000;
          return this.oauthToken;
        }
        lastError = `token endpoint ${attempt.url} -> ${res.status}: ${text.slice(0, 200)}`;
      } catch (err: any) {
        lastError = `token endpoint ${attempt.url} failed: ${err?.message || err}`;
      }
    }
    // The live v3 API exposes no public token endpoint; some accounts are issued
    // an `oc_sk_...` value that IS the bearer token. Use it directly as a fallback.
    if (/^oc_sk_/i.test(cfg.apiKey.trim())) {
      this.oauthToken = cfg.apiKey.trim();
      this.oauthExpiresAt = Date.now() + 3_600_000;
      return this.oauthToken;
    }
    throw new Error(`ByteWave OAuth2 login failed. ${lastError}`);
  }

  private async sendViaOAuth(cfg: ByteWaveConfig, input: SmsSendInput): Promise<SmsSendResult> {
    const msisdn = input.to.replace(/\D/g, '');
    const sender = input.senderId || cfg.senderId;
    const segments = countSmsSegments(input.body);

    let token: string;
    try {
      token = await this.fetchOAuthToken(cfg);
    } catch (err: any) {
      this.logger.error(`ByteWave OAuth2 login failed: ${err?.message || err}`);
      return { provider: this.name, providerMessageId: null, status: 'FAILED', costKes: 0, raw: { error: String(err?.message || err) } };
    }

    const payload = { sender, recipients: [msisdn], message: input.body };
    const sendPaths = ['sms/send', 'messages/send', 'sms', 'messages'];

    let res: Response | null = null;
    let text = '';
    let lastStatus = 0;
    for (const p of sendPaths) {
      const url = joinUrl(cfg.apiUrl, p);
      try {
        const attempt = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const bodyText = await attempt.text();
        // Only fall through to the next path on 404 (wrong action name). Any other
        // response is authoritative — retrying could double-send the SMS.
        if (attempt.status === 404) {
          lastStatus = 404;
          text = bodyText;
          continue;
        }
        res = attempt;
        text = bodyText;
        lastStatus = attempt.status;
        break;
      } catch (err: any) {
        this.logger.error(`ByteWave OAuth2 send failed (${p}): ${err?.message || err}`);
        return { provider: this.name, providerMessageId: null, status: 'FAILED', costKes: 0, raw: { error: String(err?.message || err) } };
      }
    }

    if (!res) {
      this.logger.error(`ByteWave OAuth2 send failed: no send action found (last status ${lastStatus}): ${text.slice(0, 200)}`);
      return { provider: this.name, providerMessageId: null, status: 'FAILED', costKes: 0, raw: { error: 'send action not found', detail: text.slice(0, 300) } };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    if (!res.ok || parsed?.success === false || parsed?.status === 'failed' || parsed?.status === 'error') {
      // A 401 means the cached token died; drop it so the next send re-logs in.
      if (res.status === 401) {
        this.oauthToken = null;
        this.oauthExpiresAt = 0;
      }
      this.logger.error(`ByteWave rejected message (${res.status}): ${text.slice(0, 300)}`);
      return { provider: this.name, providerMessageId: null, status: 'FAILED', costKes: 0, raw: parsed };
    }

    return {
      provider: this.name,
      providerMessageId: this.extractMessageId(parsed, cfg.idField),
      status: 'SENT',
      costKes: Number((segments * byteWaveCostPerSms()).toFixed(2)),
      raw: parsed,
    };
  }

  /** Gateways disagree on where the message id lives; try the common shapes. */
  private extractMessageId(res: any, idField: string): string | null {
    if (!res || typeof res !== 'object') return null;
    const candidates = [
      res[idField],
      res.uid,
      res?.data?.uid,
      res.messageId,
      res.message_id,
      res.message_id_no,
      res.smsid,
      res.sms_id,
      res.id,
      res?.data?.id,
      res?.data?.messageId,
      res?.data?.message_id,
      res?.messages?.[0]?.id,
      res?.results?.[0]?.id,
    ];
    const found = candidates.find((v) => v !== undefined && v !== null && v !== '');
    return found !== undefined ? String(found) : null;
  }
}
