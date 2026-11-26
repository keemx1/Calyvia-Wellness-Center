import { Injectable, BadRequestException, ServiceUnavailableException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { KenyaUtils, CommunicationChannel } from '@calyvia/shared';
import { SystemSettingsService } from '../system-admin/settings.service';
import {
  createSmsProvider,
  createWhatsAppProvider,
  bootstrapWhatsApp,
  getBaileysGateway,
} from './providers';
import {
  listSmsTemplates,
  saveSmsTemplates,
  resolveSmsTemplateBody,
  SMS_TEMPLATE_SETTING_KEY,
  SmsTemplate,
} from './sms-templates';

export interface SendMessageDto {
  recipient: string;
  channel: CommunicationChannel;
  /** Kept for API compatibility. SMS/WhatsApp have no subject line, so it is not persisted. */
  subject?: string;
  /** Optional when `templateKey` is supplied — the rendered template becomes the body. */
  body?: string;
  /** 'PATIENT' | 'FAMILY' | 'STAFF'. Stored in communication_logs.recipient_type. */
  recipientType?: string;
  /** Optional operator-edited template to render instead of supplying `body`. */
  templateKey?: string;
  /** Values for {{placeholders}} in the template. */
  variables?: Record<string, unknown>;
}

/**
 * Shape the admin UI (CommunicationView.tsx) renders. The underlying table uses
 * different column names, so we translate on both the write and the read path.
 */
export interface CommunicationLogView {
  id: string;
  recipient: string;
  channel: string;
  body: string;
  providerRef: string | null;
  status: string;
  provider: string;
  sentAt: Date | string;
  costKes: number;
}

const DEFAULT_COST_KES = 1.0;

@Injectable()
export class CommunicationService implements OnModuleInit {
  private readonly logger = new Logger(CommunicationService.name);

  constructor(
    private prisma: PrismaService,
    private settings: SystemSettingsService,
  ) {}

  async onModuleInit() {
    // Bring the WhatsApp socket up early so it is paired/connected when we need it.
    await bootstrapWhatsApp(this.settings);
  }

  async sendMessage(dto: SendMessageDto) {
    // A template (when selected) is the single source of the outbound text —
    // an explicitly supplied body is ignored so logs always match what went out.
    const body = dto.templateKey
      ? await resolveSmsTemplateBody(this.settings, dto.templateKey, dto.variables)
      : (dto.body || '').trim();
    if (!body) throw new BadRequestException('Message body is required.');
    if (!dto.recipient?.trim()) throw new BadRequestException('Recipient is required.');

    const channel = String(dto.channel || '').toUpperCase();
    const isMsisdnChannel = channel === 'SMS' || channel === 'WHATSAPP';
    const recipient = isMsisdnChannel
      ? KenyaUtils.normalizePhoneNumber(dto.recipient)
      : dto.recipient.trim();

    if (isMsisdnChannel && !/^\+\d{9,15}$/.test(recipient)) {
      throw new BadRequestException(
        `Recipient "${dto.recipient}" is not a valid Kenyan phone number (expected e.g. 0712345678).`,
      );
    }

    // Reject unsupported channels before touching a provider or the database.
    if (channel === 'EMAIL') {
      throw new BadRequestException('Email delivery is not implemented yet. Use SMS or WhatsApp.');
    }
    if (channel !== 'SMS' && channel !== 'WHATSAPP') {
      throw new BadRequestException(`Unsupported channel "${dto.channel}".`);
    }

    // Drivers are resolved per send so a gateway config change takes effect
    // immediately, without restarting the API.
    let providerName = 'unknown';
    let providerMessageId: string | null = null;
    let deliveryStatus: 'QUEUED' | 'SENT' | 'FAILED' = 'FAILED';
    // null = "the driver reported no cost"; a driver reporting 0 (WhatsApp is free)
    // must stay 0 rather than falling back to the DB default.
    let costKes: number | null = null;
    let raw: unknown;
    let dispatchError: string | null = null;

    try {
      if (channel === 'SMS') {
        const driver = await createSmsProvider(this.settings);
        providerName = driver.name;
        const res = await driver.send({ to: recipient, body });
        providerName = res.provider;
        providerMessageId = res.providerMessageId;
        deliveryStatus = res.status;
        costKes = res.costKes;
        raw = res.raw;
      } else {
        const driver = await createWhatsAppProvider(this.settings);
        providerName = driver.name;
        const res = await driver.send({ to: recipient, body });
        providerName = res.provider;
        providerMessageId = res.providerMessageId;
        deliveryStatus = res.status;
        costKes = res.costKes;
        raw = res.raw;
      }

      if (deliveryStatus === 'FAILED') {
        dispatchError =
          (raw as any)?.error || `Delivery to ${recipient} was rejected by ${providerName}.`;
      }
    } catch (err: any) {
      // A driver that cannot be constructed at all (missing credentials/package) lands here.
      dispatchError = err?.message || String(err);
      deliveryStatus = 'FAILED';
    }

    // Persist using the real column names of public.communication_logs.
    const record = await this.prisma.communicationLog.create({
      data: {
        recipientType: (dto.recipientType || 'PATIENT').toUpperCase(),
        recipientPhone: recipient,
        messageType: channel,
        messageBody: body,
        provider: providerName.toUpperCase(),
        providerMessageId,
        deliveryStatus,
        sentAt: new Date(),
        costKes: costKes ?? DEFAULT_COST_KES,
      },
    });

    if (deliveryStatus === 'FAILED') {
      this.logger.warn(`Dispatch to ${recipient} via ${providerName} FAILED. Raw: ${JSON.stringify(raw ?? {})}`);
      // The FAILED row written above is kept as an audit trail, but the caller must
      // never be told the message went out.
      throw new ServiceUnavailableException(
        dispatchError || `Delivery to ${recipient} failed via ${providerName}.`,
      );
    }

    return this.toView(record);
  }

  async getRecentLogs(): Promise<CommunicationLogView[]> {
    try {
      const rows = await this.prisma.communicationLog.findMany({
        orderBy: { sentAt: 'desc' },
        take: 50,
      });
      return (rows || []).map((r: any) => this.toView(r));
    } catch (err) {
      this.logger.warn(`Communication logs fetch error: ${(err as any)?.message || err}`);
      return [];
    }
  }

  /** All SMS message formats, with operator edits layered over the defaults. */
  getSmsTemplates(): Promise<SmsTemplate[]> {
    return listSmsTemplates(this.settings);
  }

  /** Persist operator edits to the SMS message formats. */
  updateSmsTemplates(entries: unknown): Promise<SmsTemplate[]> {
    return saveSmsTemplates(this.settings, entries);
  }

  /** Render a template without dispatching anything, for the admin preview. */
  async previewSmsTemplate(key: string, variables: Record<string, unknown> = {}) {
    return { key, body: await resolveSmsTemplateBody(this.settings, key, variables) };
  }

  /** Discard operator edits and restore the built-in message formats. */
  async resetSmsTemplates(): Promise<SmsTemplate[]> {
    await this.settings.set(SMS_TEMPLATE_SETTING_KEY, '', {
      description: 'SMS templates reset to built-in defaults',
    });
    return this.getSmsTemplates();
  }

  /** Live status of the WhatsApp (Baileys) session, including pairing material. */
  getWhatsAppStatus() {
    return getBaileysGateway().getStatus();
  }

  /** Request a WhatsApp pairing code for a phone number (headless linking). */
  async requestWhatsAppPairing(phone: string) {
    const normalized = KenyaUtils.normalizePhoneNumber(phone);
    try {
      const code = await getBaileysGateway().requestPairingCode(normalized);
      return { phone: normalized, pairingCode: code };
    } catch (err: any) {
      // A 500 with a bare "Connection Closed" told the operator nothing.
      throw new ServiceUnavailableException(
        err?.message || 'Could not request a WhatsApp pairing code.',
      );
    }
  }

  /** Translate a DB row (snake or camel) into the shape the admin UI expects. */
  private toView(row: any): CommunicationLogView {
    return {
      id: row.id,
      recipient: row.recipientPhone ?? row.recipient_phone ?? '',
      channel: row.messageType ?? row.message_type ?? '',
      body: row.messageBody ?? row.message_body ?? '',
      providerRef: row.providerMessageId ?? row.provider_message_id ?? null,
      status: row.deliveryStatus ?? row.delivery_status ?? 'SENT',
      provider: row.provider ?? 'MOCK',
      sentAt: row.sentAt ?? row.sent_at ?? '',
      costKes: Number(row.costKes ?? row.cost_kes ?? 0),
    };
  }
}
