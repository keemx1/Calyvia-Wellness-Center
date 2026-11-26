import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  WhatsAppProvider,
  WhatsAppSendInput,
  WhatsAppSendResult,
  toWhatsAppJid,
} from './whatsapp-provider';

/** Baileys dials web.whatsapp.com — NOT web.whatsapp.net (which does not resolve). */
export const WHATSAPP_HOST = 'web.whatsapp.com';
export const WHATSAPP_WS_URL = `wss://${WHATSAPP_HOST}/ws/chat`;

/**
 * WhatsApp via Baileys (https://github.com/WhiskeySockets/Baileys).
 *
 * ⚠️ UNOFFICIAL / ToS RISK — READ BEFORE ENABLING
 * Baileys speaks the WhatsApp Web multi-device protocol. It is NOT the official
 * WhatsApp Business Cloud API and it violates WhatsApp's Terms of Service for
 * automated or bulk messaging. Meta actively bans numbers doing this. Baileys'
 * own README discourages bulk/automated usage. For a clinical facility the safe
 * posture is: run this on a number you can afford to lose, and keep SMS as the
 * channel of record for anything mission-critical. See
 * docs/runbooks/whatsapp-ban-risk.md.
 *
 * Operational notes:
 *  - Requires a persistent login session (QR or pairing code). The session is
 *    stored under BAILEYS_AUTH_DIR and must survive restarts.
 *  - The linked phone must stay online; a revoked session means re-pairing.
 *  - Pinned to the stable 6.x line (`@whiskeysockets/baileys`). v7 is a release
 *    candidate with breaking changes — do not upgrade casually.
 *
 * Config:
 *   BAILEYS_AUTH_DIR   Where the login session is persisted (default .baileys-auth)
 *   BAILEYS_CLIENT_VERSION     Pin the client revision sent in the handshake.
 *   BAILEYS_USE_LATEST_VERSION Opt in to the revision from Baileys' GitHub master.
 *                              Leave unset: using a revision newer than this
 *                              installed library gets the socket closed with 428.
 */
export class BaileysWhatsAppGateway {
  private readonly logger = new Logger('BaileysWhatsAppGateway');
  private readonly authDir: string;

  private sock: any = null;
  private baileys: any = null;
  private saveCreds: (() => Promise<void>) | null = null;

  private status: 'disconnected' | 'connecting' | 'awaiting_qr' | 'open' | 'closed' = 'disconnected';
  private qr: string | null = null;
  private pairingCode: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private starting: Promise<void> | null = null;
  /** Why the socket last closed — surfaced via getStatus() for diagnosis. */
  private lastDisconnect: { statusCode: number | null; message: string | null; at: string } | null =
    null;
  /** WhatsApp web protocol version in use and where it came from. */
  private versionInfo: {
    version: [number, number, number] | null;
    source: 'latest' | 'bundled' | 'override';
  } = { version: null, source: 'bundled' };
  /** Waiters parked until a QR arrives (pairing codes need a live handshake). */
  private qrWaiters: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

  constructor() {
    this.authDir = process.env.BAILEYS_AUTH_DIR || path.resolve(process.cwd(), '.baileys-auth');
  }

  /** Boot the socket. Safe to call repeatedly; concurrent calls share one start. */
  async start(): Promise<void> {
    if (this.status === 'open') return;
    if (this.starting) return this.starting;
    this.starting = this.doStart().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  /**
   * Decide which client revision to advertise in the WhatsApp handshake.
   *
   * Default: `undefined`, which makes Baileys use the version bundled with the
   * installed package — the only combination guaranteed to speak the protocol
   * this library implements. Overrides are explicit operator choices:
   *   BAILEYS_CLIENT_VERSION=2.3000.1043857760  pin a specific revision
   *   BAILEYS_USE_LATEST_VERSION=true            opt into the GitHub master revision
   */
  async resolveVersion(): Promise<[number, number, number] | undefined> {
    const pinned = process.env.BAILEYS_CLIENT_VERSION?.trim();
    if (pinned) {
      const parts = pinned.split('.').map(Number);
      if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
        throw new Error(
          `BAILEYS_CLIENT_VERSION="${pinned}" is invalid; expected three numbers, e.g. 2.3000.1043857760.`,
        );
      }
      this.versionInfo = { version: parts as [number, number, number], source: 'override' };
      this.logger.warn(`Using pinned WhatsApp client revision ${pinned}.`);
      return this.versionInfo.version!;
    }

    if (process.env.BAILEYS_USE_LATEST_VERSION?.trim().toLowerCase() === 'true') {
      try {
        const latest = await this.withTimeout<any>(
          this.baileys.fetchLatestBaileysVersion(),
          15_000,
          'fetchLatestBaileysVersion',
        );
        if (latest?.version) {
          this.versionInfo = { version: latest.version, source: 'latest' };
          return latest.version;
        }
      } catch (err: any) {
        this.logger.warn(
          `Could not fetch latest Baileys version, using bundled default: ${err?.message || err}`,
        );
      }
    }

    this.versionInfo = { version: null, source: 'bundled' };
    return undefined;
  }

  private async doStart(): Promise<void> {
    await this.loadModule();
    fs.mkdirSync(this.authDir, { recursive: true });

    // Tear down the previous socket (reconnect path) so two sockets never
    // fight over the same session and WhatsApp doesn't close both.
    if (this.sock) {
      try {
        this.sock.ev?.removeAllListeners?.();
        this.sock.end?.(undefined);
      } catch {
        /* old socket is already dead */
      }
      this.sock = null;
    }

    const { state, saveCreds } = await this.baileys.useMultiFileAuthState(this.authDir);
    this.saveCreds = saveCreds;

    // DO NOT fetch the version from Baileys' GitHub master by default. That file
    // tracks the library's next release, not the 6.7.24 installed here; sending
    // that newer client revision in the handshake makes WhatsApp terminate the
    // websocket with 428 before a QR is ever issued.
    const version = await this.resolveVersion();

    this.status = 'connecting';
    const browser = this.baileys.Browsers?.ubuntu
      ? this.baileys.Browsers.ubuntu('Calyvia')
      : undefined;

    // Baileys calls logger.child() and then uses trace/debug/info on the result.
    // Returning the Nest logger here crashes the handshake (Nest has no trace()).
    const baileysLogger: any = {
      level: 'silent',
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: (msg: unknown) => this.logger.warn(String(msg)),
      error: (msg: unknown) => this.logger.error(String(msg)),
      fatal: (msg: unknown) => this.logger.error(String(msg)),
      child: () => baileysLogger,
    };

    // Omit `version` entirely for the bundled default. Passing `version: undefined`
    // overrides Baileys' default with undefined and its registration node crashes
    // on `config.version.join('.')`.
    const socketConfig: any = {
      auth: state,
      browser,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      logger: baileysLogger,
    };
    if (version) socketConfig.version = version;

    this.sock = this.baileys.makeWASocket(socketConfig);

    this.sock.ev.on('creds.update', this.saveCreds);
    this.sock.ev.on('connection.update', (update: any) => this.handleConnectionUpdate(update));
  }

  /** Single place that reacts to Baileys connection updates (also unit-tested directly). */
  handleConnectionUpdate(update: any): void {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.qr = qr;
      this.status = 'awaiting_qr';
      this.logger.log('WhatsApp awaiting pairing — scan the QR via GET /communication/whatsapp/status');
      this.settleQrWaiters();
    }

    if (connection === 'open') {
      // A healthy session resets the backoff so a later drop retries promptly.
      this.reconnectAttempts = 0;
      this.status = 'open';
      this.qr = null;
      this.pairingCode = null;
      this.logger.log('WhatsApp session connected.');
      this.settleQrWaiters();
    }

    if (connection === 'close') {
      const statusCode: number | null =
        lastDisconnect?.error?.output?.statusCode ?? lastDisconnect?.error?.statusCode ?? null;
      const message: string | null =
        lastDisconnect?.error?.message ||
        lastDisconnect?.error?.output?.payload?.message ||
        null;
      this.lastDisconnect = { statusCode, message, at: new Date().toISOString() };
      // A stale QR is worse than no QR: operators scan it and link nothing.
      this.qr = null;

      const loggedOut = statusCode === this.baileys?.DisconnectReason?.loggedOut;
      this.status = loggedOut ? 'closed' : 'disconnected';
      const detail = `${statusCode ?? 'no-code'}${message ? ` — ${message}` : ''}`;
      this.logger.warn(`WhatsApp connection closed (code=${detail}).`);

      const hint =
        statusCode === 428
          ? ' The websocket was terminated during the handshake. Check outbound WebSocket access ' +
            `to ${WHATSAPP_WS_URL} (proxy/firewall) via GET /communication/whatsapp/diagnostics. ` +
            'BAILEYS_USE_LATEST_VERSION is unset, so the installed Baileys protocol revision is used.'
          : '';
      const closeError = new Error(`WhatsApp connection closed (code=${detail}).${hint}`);

      if (loggedOut) {
        this.logger.error(
          'WhatsApp session was logged out. Clear BAILEYS_AUTH_DIR and re-pair the number.',
        );
        this.rejectQrWaiters(new Error('WhatsApp session was logged out; re-pair required.'));
      } else {
        // Don't park pairing callers for 25s on a socket that is already dead.
        this.rejectQrWaiters(closeError);
        this.scheduleReconnect();
      }
    }
  }

  private settleQrWaiters(): void {
    for (const w of this.qrWaiters.splice(0)) w.resolve();
  }

  private rejectQrWaiters(err: Error): void {
    for (const w of this.qrWaiters.splice(0)) w.reject(err);
  }

  /**
   * Resolve once the socket reaches a state where pairing codes are possible
   * (QR issued or fully open), or reject with the last close reason.
   */
  private waitForQr(ms: number): Promise<void> {
    if (this.status === 'awaiting_qr' || this.status === 'open') return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const waiter = { resolve, reject };
      this.qrWaiters.push(waiter);
      const timer = setTimeout(() => {
        this.qrWaiters = this.qrWaiters.filter((w) => w !== waiter);
        const reason = this.lastDisconnect
          ? `last close: ${this.lastDisconnect.statusCode ?? 'no-code'}${this.lastDisconnect.message ? ` — ${this.lastDisconnect.message}` : ''}`
          : 'no close event recorded yet';
        reject(
          new Error(
            `WhatsApp socket did not reach pairing state within ${Math.round(ms / 1000)}s (${reason}). ` +
              `Check outbound WebSocket access to ${WHATSAPP_WS_URL} (port 443) with ` +
              'GET /communication/whatsapp/diagnostics. If the socket closes before a QR every ' +
              'time, reset the local session (POST /communication/whatsapp/reset) once.',
          ),
        );
      }, ms);
      const originalResolve = waiter.resolve;
      waiter.resolve = () => {
        clearTimeout(timer);
        originalResolve();
      };
      const originalReject = waiter.reject;
      waiter.reject = (e: Error) => {
        clearTimeout(timer);
        originalReject(e);
      };
    });
  }

  /**
   * Exponential backoff (5s → 10s → 20s → … → 5min, plus jitter). WhatsApp
   * treats rapid repeated registration attempts as abuse and answers 428; a
   * fixed 5s loop makes a transient failure permanent.
   */
  private reconnectDelayFor(attempt: number): number {
    const base = Math.min(5_000 * 2 ** Math.min(Math.max(attempt, 0), 6), 300_000);
    return base + Math.floor(Math.random() * 1000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = this.reconnectDelayFor(this.reconnectAttempts++);
    this.logger.warn(`Scheduling WhatsApp reconnect in ${Math.round(delay / 1000)}s.`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.start().catch((err: any) =>
        this.logger.error(`WhatsApp reconnect failed: ${err?.message || err}`),
      );
    }, delay);
  }

  /**
   * Race a promise against a timer. The loser gets a no-op settlement handler so
   * a late failure can never surface as an unhandled rejection (which Node turns
   * into a process crash).
   */
  private async withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
      promise.then(
        () => {},
        () => {},
      );
    }
  }

  /**
   * Ask WhatsApp for a pairing code (no QR scan needed). The code is entered on
   * the phone under "Linked devices" > "Link with phone number".
   *
   * WhatsApp only issues pairing codes after the websocket handshake produced a
   * QR — asking earlier fails with a bare "Connection Closed". Wait for that
   * state (up to 25s) so the caller gets an actionable error instead.
   */
  async requestPairingCode(phoneE164: string, waitMs = 25_000): Promise<string> {
    await this.start();
    if (!this.sock?.requestPairingCode) {
      throw new Error('This Baileys version does not support pairing codes; use the QR flow.');
    }
    await this.waitForQr(waitMs);

    // Baileys wants digits only, with country code, no '+'.
    const digits = phoneE164.replace(/\D/g, '');
    const code = await this.sock.requestPairingCode(digits);
    this.pairingCode = code;
    return code;
  }

  /** Send a plain text message. Throws if the session is not connected. */
  async sendText(to: string, body: string): Promise<{ messageId: string | null }> {
    if (this.status !== 'open' || !this.sock) {
      throw new Error(
        `WhatsApp session is not connected (state=${this.status}). ` +
          `Pair the number first via GET /communication/whatsapp/status.`,
      );
    }
    const jid = toWhatsAppJid(to);
    const sent = await this.sock.sendMessage(jid, { text: body });
    return { messageId: sent?.key?.id ?? null };
  }

  /**
   * Clear a stale/corrupt Baileys session and open a fresh handshake. Useful when
   * WhatsApp closes every attempt before a QR — e.g. credentials left behind by a
   * failed pairing.
   *
   * The auth directory is normally a mounted persistent volume (Coolify/Docker).
   * Removing the directory itself fails with EBUSY on a mount point, so we delete
   * only its CONTENTS and leave the directory in place.
   */
  async resetSession(): Promise<void> {
    const resolved = path.resolve(this.authDir);
    const root = path.parse(resolved).root;
    if (resolved === root || resolved === process.cwd()) {
      throw new Error(
        'Refusing to clear a WhatsApp session directory equal to the filesystem or project root.',
      );
    }

    // Let any in-flight start finish before we tear its socket down.
    if (this.starting) {
      try {
        await this.starting;
      } catch {
        /* start already reported its failure */
      }
    }

    if (this.sock) {
      const sock = this.sock;
      // Give the socket a bounded chance to release its files before unlinking.
      await new Promise<void>((done) => {
        let settled = false;
        let timer: NodeJS.Timeout | undefined;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          done();
        };
        sock.ev?.once?.('connection.update', (u: any) => {
          if (u?.connection === 'close') finish();
        });
        timer = setTimeout(finish, 2_000);
        try {
          sock.end?.(undefined);
        } catch {
          finish();
        }
      });
      try {
        sock.ev?.removeAllListeners?.();
      } catch {
        /* already gone */
      }
      this.sock = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.status = 'disconnected';
    this.qr = null;
    this.pairingCode = null;
    this.lastDisconnect = null;
    this.reconnectAttempts = 0;
    this.rejectQrWaiters(new Error('WhatsApp session was reset; request pairing again.'));

    fs.mkdirSync(resolved, { recursive: true });
    try {
      for (const entry of fs.readdirSync(resolved)) {
        fs.rmSync(path.join(resolved, entry), { recursive: true, force: true });
      }
    } catch (err: any) {
      throw new Error(
        `Could not clear WhatsApp session files in ${resolved}: ${err?.message || err}. ` +
          'Ensure the mounted directory is writable and no other process is using it.',
      );
    }
    this.logger.warn(`Cleared WhatsApp session files in ${resolved}; reconnecting.`);
    await this.start();
  }

  /**
   * Network probe used when the socket keeps closing before a QR. It separates
   * "the VPS cannot reach WhatsApp" from "Baileys/WhatsApp rejected the client".
   * No credentials are involved and no session is created.
   */
  async diagnose() {
    const out: Record<string, unknown> = {
      at: new Date().toISOString(),
      node: process.version,
      authDir: this.authDir,
      // Names only — never echo proxy credentials/URLs.
      proxyEnv: ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'].filter(
        (k) => !!process.env[k],
      ),
      session: this.getStatus(),
      target: WHATSAPP_WS_URL,
    };

    try {
      out.authFiles = fs.readdirSync(this.authDir);
    } catch (err: any) {
      out.authFiles = { error: err?.message || String(err) };
    }

    try {
      const dns: any = await import('dns');
      const addresses = await dns.promises.lookup(WHATSAPP_HOST, { all: true });
      out.dns = addresses.map((a: any) => ({ family: a.family, address: a.address }));
    } catch (err: any) {
      out.dns = { error: err?.message || String(err) };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      try {
        const res = await fetch(`https://${WHATSAPP_HOST}/`, { signal: controller.signal });
        out.https = { status: res.status };
      } finally {
        clearTimeout(timer);
      }
    } catch (err: any) {
      out.https = { error: err?.message || String(err) };
    }

    try {
      // Dynamic specifier keeps this optional at compile time (no @types/ws).
      const specifier = 'ws';
      const mod: any = await import(specifier);
      const WebSocket = mod.default || mod;
      out.websocket = await new Promise((resolve) => {
        let settled = false;
        const finish = (result: Record<string, unknown>) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          try {
            ws.terminate();
          } catch {
            /* already closed */
          }
          resolve(result);
        };
        const timer = setTimeout(() => finish({ error: 'no websocket open within 8s' }), 8_500);
        const ws = new WebSocket(WHATSAPP_WS_URL, {
          origin: `https://${WHATSAPP_HOST}`,
          handshakeTimeout: 8_000,
        });
        ws.once('open', () => finish({ open: true }));
        ws.once('unexpected-response', (_req: unknown, res: any) =>
          finish({ httpStatus: res?.statusCode ?? null }),
        );
        ws.once('error', (err: any) => finish({ error: err?.message || String(err) }));
        ws.once('close', (code: number) => finish({ closeCode: code }));
      });
    } catch (err: any) {
      out.websocket = { error: err?.message || String(err) };
    }

    return out;
  }

  getStatus() {
    return {
      status: this.status,
      connected: this.status === 'open',
      qr: this.qr,
      pairingCode: this.pairingCode,
      authDir: this.authDir,
      lastDisconnect: this.lastDisconnect,
      baileysVersion: this.versionInfo.version ? this.versionInfo.version.join('.') : null,
      versionSource: this.versionInfo.source,
    };
  }

  private async loadModule(): Promise<void> {
    if (this.baileys) return;
    // Resolved via a variable so the package stays optional at compile time.
    const specifier = '@whiskeysockets/baileys';
    try {
      this.baileys = await import(specifier);
    } catch {
      throw new Error(
        "WHATSAPP_PROVIDER=baileys requires the '@whiskeysockets/baileys' package. " +
          'Install it with: npm i @whiskeysockets/baileys@^6.7.24',
      );
    }
  }
}

/** Singleton socket owner — one WhatsApp session per API process. */
let gatewayInstance: BaileysWhatsAppGateway | null = null;

export function getBaileysGateway(): BaileysWhatsAppGateway {
  if (!gatewayInstance) gatewayInstance = new BaileysWhatsAppGateway();
  return gatewayInstance;
}

/** WhatsApp driver backed by the shared Baileys gateway. */
export class BaileysWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'baileys';
  private readonly gateway = getBaileysGateway();
  private readonly logger = new Logger('BaileysWhatsAppProvider');

  async send(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    try {
      const { messageId } = await this.gateway.sendText(input.to, input.body);
      return {
        provider: this.name,
        providerMessageId: messageId,
        status: 'SENT',
        costKes: 0,
      };
    } catch (err: any) {
      this.logger.error(`WhatsApp send failed to ${input.to}: ${err?.message || err}`);
      return {
        provider: this.name,
        providerMessageId: null,
        status: 'FAILED',
        costKes: 0,
        raw: { error: String(err?.message || err) },
      };
    }
  }
}
