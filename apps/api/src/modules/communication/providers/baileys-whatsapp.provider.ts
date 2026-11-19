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

    const { state, saveCreds } = await this.baileys.useMultiFileAuthState(this.authDir);
    this.saveCreds = saveCreds;

    let version: [number, number, number] | undefined;
    try {
      const latest = await this.baileys.fetchLatestBaileysVersion();
      version = latest?.version;
    } catch {
      /* fall back to the version bundled with Baileys */
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

    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qr = qr;
        this.status = 'awaiting_qr';
        this.logger.log('WhatsApp awaiting pairing — scan the QR via GET /communication/whatsapp/status');
      }

      if (connection === 'open') {
        this.status = 'open';
        this.qr = null;
        this.pairingCode = null;
        this.logger.log('WhatsApp session connected.');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === this.baileys.DisconnectReason?.loggedOut;
        this.status = loggedOut ? 'closed' : 'disconnected';
        this.logger.warn(`WhatsApp connection closed (code=${statusCode ?? 'unknown'}).`);

        if (loggedOut) {
          this.logger.error(
            'WhatsApp session was logged out. Clear BAILEYS_AUTH_DIR and re-pair the number.',
          );
        } else {
          this.scheduleReconnect();
        }
      }
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
   * Ask WhatsApp for a pairing code (no QR scan needed). The code is entered on
   * the phone under "Linked devices" > "Link with phone number".
   */
  async requestPairingCode(phoneE164: string): Promise<string> {
    await this.start();
    if (!this.sock?.requestPairingCode) {
      throw new Error('This Baileys version does not support pairing codes; use the QR flow.');
    }
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
