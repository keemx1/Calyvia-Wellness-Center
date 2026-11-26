import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { ConfigResolver } from '../communication/providers/config-resolver';

/**
 * Definition of an operator-editable gateway setting.
 *
 * `envVar` is the deployment environment variable that takes precedence; `key` is
 * the `system_settings.setting_key` used when the environment does not define it.
 */
export interface GatewaySettingDef {
  key: string;
  envVar: string;
  label: string;
  group: 'SMS' | 'WHATSAPP';
  description: string;
  /** Never returned in plaintext by the read API. */
  secret?: boolean;
  /** Allowed values; renders as a select in the admin UI. */
  options?: string[];
  placeholder?: string;
}

/**
 * The curated set of gateway settings editable from the admin UI.
 * Everything else (auth style, payload shape, timeouts) stays env-only on purpose.
 */
export const GATEWAY_SETTINGS: GatewaySettingDef[] = [
  {
    key: 'gateway.sms.provider',
    envVar: 'SMS_PROVIDER',
    label: 'SMS provider',
    group: 'SMS',
    description:
      'Which SMS gateway dispatches messages. Use bytewave in production; mock is for local development only.',
    options: ['mock', 'bytewave'],
  },
  {
    key: 'gateway.sms.bytewave.mode',
    envVar: 'BYTEWAVE_API_MODE',
    label: 'ByteWave API mode',
    group: 'SMS',
    description: 'HTTP uses the simple key endpoint; OAuth2 uses client credentials against /api/v3/.',
    options: ['http', 'oauth2'],
  },
  {
    key: 'gateway.sms.bytewave.api_url',
    envVar: 'BYTEWAVE_API_URL',
    label: 'ByteWave API endpoint',
    group: 'SMS',
    description:
      'HTTP: https://portal.bytewavenetworks.com/api/http/ — OAuth2: https://portal.bytewavenetworks.com/api/v3/',
    placeholder: 'https://portal.bytewavenetworks.com/api/http/',
  },
  {
    key: 'gateway.sms.bytewave.api_key',
    envVar: 'BYTEWAVE_API_KEY',
    label: 'ByteWave API key',
    group: 'SMS',
    description:
      'HTTP API key, or the combined oc_sk_ key for OAuth2 (auto-split when client id/secret are empty). Stored encrypted.',
    secret: true,
    placeholder: 'Paste the key from the portal',
  },
  {
    key: 'gateway.sms.bytewave.client_id',
    envVar: 'BYTEWAVE_CLIENT_ID',
    label: 'ByteWave OAuth client ID',
    group: 'SMS',
    description: 'OAuth2 only. Optional when the combined oc_sk_ key is used.',
    placeholder: 'e.g. 9f2c7b4a1d08',
  },
  {
    key: 'gateway.sms.bytewave.client_secret',
    envVar: 'BYTEWAVE_CLIENT_SECRET',
    label: 'ByteWave OAuth client secret',
    group: 'SMS',
    description: 'OAuth2 only. Stored encrypted. Optional when the combined oc_sk_ key is used.',
    secret: true,
  },
  {
    key: 'gateway.sms.bytewave.sender_id',
    envVar: 'BYTEWAVE_SENDER_ID',
    label: 'ByteWave sender ID',
    group: 'SMS',
    description: 'Registered sender name or shortcode shown to recipients.',
    placeholder: 'CALYVIA',
  },
  {
    key: 'gateway.whatsapp.provider',
    envVar: 'WHATSAPP_PROVIDER',
    label: 'WhatsApp provider',
    group: 'WHATSAPP',
    description:
      'baileys is an unofficial client — see docs/runbooks/whatsapp-ban-risk.md before enabling.',
    options: ['mock', 'baileys'],
  },
  {
    key: 'gateway.whatsapp.baileys.auth_dir',
    envVar: 'BAILEYS_AUTH_DIR',
    label: 'Baileys session directory',
    group: 'WHATSAPP',
    description: 'Where the WhatsApp login session is persisted. Must survive deploys.',
    placeholder: '.baileys-auth',
  },
];

export interface GatewaySettingView {
  key: string;
  envVar: string;
  label: string;
  group: string;
  description: string;
  secret: boolean;
  options?: string[];
  placeholder?: string;
  value: string;
  /** Where the effective value came from. */
  source: 'env' | 'database' | 'unset';
  /** True when a value is configured but hidden. */
  hasValue: boolean;
}

@Injectable()
export class SystemSettingsService implements ConfigResolver {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  /**
   * Resolve a gateway setting: the deployment environment always wins, and
   * `system_settings` is the operator-editable fallback. This is what lets an
   * admin change an API key from the UI without touching Coolify.
   */
  async get(envVar: string, settingKey: string): Promise<string | undefined> {
    const fromEnv = process.env[envVar]?.trim();
    if (fromEnv) return fromEnv;

    const fromDb = await this.readSetting(settingKey);
    return fromDb || undefined;
  }

  /** Same as get(), but throws when the value is configured nowhere. */
  async require(envVar: string, settingKey: string): Promise<string> {
    const value = await this.get(envVar, settingKey);
    if (!value) {
      throw new Error(
        `"${envVar}" is not configured. Set it in the deployment environment or in System Settings (${settingKey}).`,
      );
    }
    return value;
  }

  /** Read one row, decrypting it when flagged. */
  async readSetting(key: string): Promise<string | null> {
    try {
      const row = await this.prisma.systemSetting.findUnique({ where: { settingKey: key } });
      if (!row) return null;
      const raw = row.settingValue ?? row.setting_value;
      const encrypted = row.isEncrypted ?? row.is_encrypted;
      return encrypted ? this.crypto.decrypt(raw) : raw;
    } catch (err: any) {
      this.logger.warn(`Failed to read setting "${key}": ${err?.message || err}`);
      return null;
    }
  }

  /**
   * Create or update a setting. Secrets are encrypted at rest with AES-256-GCM.
   * Passing a blank value for a secret clears it.
   */
  async set(
    key: string,
    value: string,
    opts: { description?: string; isEncrypted?: boolean } = {},
  ): Promise<{ key: string; stored: boolean; isEncrypted: boolean }> {
    const isEncrypted = opts.isEncrypted ?? false;
    const trimmed = value ?? '';
    const stored = isEncrypted && trimmed ? this.crypto.encrypt(trimmed) : trimmed;

    await this.prisma.systemSetting.upsert({
      where: { settingKey: key },
      update: {
        settingValue: stored,
        ...(opts.description !== undefined ? { description: opts.description } : {}),
        isEncrypted,
      },
      create: {
        settingKey: key,
        settingValue: stored,
        description: opts.description ?? null,
        isEncrypted,
      },
    });

    this.logger.log(`Setting "${key}" updated (encrypted=${isEncrypted}).`);
    return { key, stored: true, isEncrypted };
  }

  /** All gateway settings with their effective value and source, secrets masked. */
  async listGatewaySettings(): Promise<GatewaySettingView[]> {
    const out: GatewaySettingView[] = [];

    for (const def of GATEWAY_SETTINGS) {
      const fromEnv = process.env[def.envVar]?.trim();
      const fromDb = fromEnv ? null : await this.readSetting(def.key);

      const effective = fromEnv ?? fromDb ?? '';
      const source: GatewaySettingView['source'] = fromEnv
        ? 'env'
        : fromDb
          ? 'database'
          : 'unset';

      out.push({
        key: def.key,
        envVar: def.envVar,
        label: def.label,
        group: def.group,
        description: def.description,
        secret: !!def.secret,
        options: def.options,
        placeholder: def.placeholder,
        // Never echo a secret back to the client.
        value: def.secret ? '' : effective,
        source,
        hasValue: !!effective,
      });
    }

    return out;
  }

  /**
   * Persist UI-submitted settings. Blank values on secrets mean "leave unchanged",
   * except an explicit clear flag.
   */
  async saveGatewaySettings(
    entries: Array<{ key: string; value: string }>,
    opts: { clearSecrets?: boolean } = {},
  ): Promise<Array<{ key: string; stored: boolean }>> {
    const byKey = new Map(GATEWAY_SETTINGS.map((d) => [d.key, d]));
    const results: Array<{ key: string; stored: boolean }> = [];

    for (const entry of entries) {
      const def = byKey.get(entry.key);
      if (!def) {
        results.push({ key: entry.key, stored: false });
        continue;
      }

      // An env var is authoritative, so a DB write would have no effect. Report it
      // honestly rather than storing a value that will be ignored.
      if (process.env[def.envVar]?.trim()) {
        this.logger.warn(
          `Ignoring write to "${entry.key}": ${def.envVar} is set in the environment and takes precedence.`,
        );
        results.push({ key: entry.key, stored: false });
        continue;
      }

      const value = entry.value ?? '';
      if (def.secret && !value && !opts.clearSecrets) {
        results.push({ key: entry.key, stored: true }); // unchanged
        continue;
      }

      await this.set(entry.key, value, {
        description: def.description,
        isEncrypted: !!def.secret,
      });
      results.push({ key: entry.key, stored: true });
    }

    return results;
  }
}
