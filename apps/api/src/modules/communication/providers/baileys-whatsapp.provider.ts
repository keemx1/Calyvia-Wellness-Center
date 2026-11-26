import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  WhatsAppProvider,
  WhatsAppSendInput,
  WhatsAppSendResult,
  toWhatsAppJid,
} from './whatsapp-provider';

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
 *   BAILEYS_PAIRING_MS Phone number (E.164) used to request a pairing code instead
 *                      of a QR, for headless servers.
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
  private starting: Promise<void> | null = null;
  /** Why the socket last closed — surfaced via getStatus() for diagnosis. */
  private lastDisconnect: { statusCode: number | null; message: string | null; at: string } | null =
    null;
  /** WhatsApp web protocol version in use and where it came from. */
  private versionInfo: { version: [number, number, number] | null; source: 'latest' | 'bundled' } = {
    version: null,
    source: 'bundled',
  };
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

    let version: [number, number, number] | undefined;
    try {
      // Never let a hung version check stall API boot: Nest waits for
      // onModuleInit, so an unsettled promise here means the app never listens.
      const latest = await this.withTimeout<any>(
        this.baileys.fetchLatestBaileysVersion(),
        15_000,
        'fetchLatestBaileysVersion',
      );
      version = latest?.version;
      if (version) this.versionInfo = { version, source: 'latest' };
    } catch (err: any) {
      this.versionInfo = { version: null, source: 'bundled' };
      this.logger.warn(
        `Using bundled Baileys version (latest-version check failed: ${err?.message || err})`,
      );
    }

    this.status = 'connecting';
    const browser = this.baileys.Browsers?.ubuntu
      ? this.baileys.Browsers.ubuntu('Calyvia')
      : undefined;

    this.sock = this.baileys.makeWASocket({
      auth: state,
      version,
      browser,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      // Quiet down Baileys' very chatty pino logger.
      logger: {
        level: 'silent',
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: (msg: unknown) => this.logger.warn(String(msg)),
        error: (msg: unknown) => this.logger.error(String(msg)),
        child: () => this.logger as any,
      },
    });

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

      const loggedOut = statusCode === this.baileys?.DisconnectReason?.loggedOut;
      this.status = loggedOut ? 'closed' : 'disconnected';
      this.logger.warn(
        `WhatsApp connection closed (code=${statusCode ?? 'unknown'}${message ? `, ${message}` : ''}).`,
      );

      if (loggedOut) {
        this.logger.error(
          'WhatsApp session was logged out. Clear BAILEYS_AUTH_DIR and re-pair the number.',
        );
        this.rejectQrWaiters(new Error('WhatsApp session was logged out; re-pair required.'));
      } else {
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
              'The API server may be unable to reach WhatsApp on port 443 (firewall/proxy egress), ' +
              'or the Baileys protocol version is being rejected.',
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

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.start().catch((err: any) =>
        this.logger.error(`WhatsApp reconnect failed: ${err?.message || err}`),
      );
    }, 5_000);
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
