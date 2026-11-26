import { Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider';
import { WhatsAppProvider } from './whatsapp-provider';
import { ConfigResolver, resolveSmsProviderName } from './config-resolver';
import { MockSmsProvider } from './mock-sms.provider';
import { MockWhatsAppProvider } from './mock-whatsapp.provider';
import { ByteWaveSmsProvider } from './bytewave-sms.provider';
import { BaileysWhatsAppProvider, getBaileysGateway } from './baileys-whatsapp.provider';

export * from './sms-provider';
export * from './whatsapp-provider';
export * from './config-resolver';
export * from './mock-sms.provider';
export * from './mock-whatsapp.provider';
export * from './bytewave-sms.provider';
export * from './baileys-whatsapp.provider';

const logger = new Logger('CommunicationProviders');

/**
 * Used when a configured driver cannot be constructed (missing credentials, missing
 * package). It keeps the API bootable while refusing to fake a delivery: every send
 * is recorded as FAILED with the real reason, instead of silently pretending to work.
 */
class UnavailableSmsProvider implements SmsProvider {
  readonly name = 'unavailable';
  constructor(private readonly reason: string) {}
  async send(): Promise<import('./sms-provider').SmsSendResult> {
    throw new Error(this.reason);
  }
}

class UnavailableWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'unavailable';
  constructor(private readonly reason: string) {}
  async send(): Promise<import('./whatsapp-provider').WhatsAppSendResult> {
    throw new Error(this.reason);
  }
}

/**
 * Driver selection is driven by configuration so we can move from local dev ->
 * sandbox -> production without code changes:
 *
 *   SMS_PROVIDER       bytewave (production) | mock (local dev/test only)
 *   WHATSAPP_PROVIDER  mock | baileys
 *
 * The provider name resolves through `ConfigResolver` (deployment env wins,
 * `system_settings` is the fallback) so an admin can switch gateways from the UI.
 */
export async function createSmsProvider(config: ConfigResolver): Promise<SmsProvider> {
  const configured = await config.get('SMS_PROVIDER', 'gateway.sms.provider');
  // In production this always resolves to ByteWave; `mock` remains available to
  // local dev and the test suite only.
  const provider =
    resolveSmsProviderName(configured) ||
    (process.env.NODE_ENV === 'production' ? 'bytewave' : 'mock');

  try {
    switch (provider) {
      case 'bytewave':
        return new ByteWaveSmsProvider(config);
      case 'mock':
        return new MockSmsProvider();
      default:
        logger.warn(`Unknown SMS_PROVIDER "${provider}" — falling back to mock driver.`);
        return new MockSmsProvider();
    }
  } catch (err: any) {
    const reason = err?.message || String(err);
    logger.error(`SMS provider "${provider}" failed to initialise: ${reason}`);
    logger.error('SMS dispatch is DISABLED until this is fixed. Sends will be recorded as FAILED.');
    return new UnavailableSmsProvider(`SMS provider "${provider}" is unavailable: ${reason}`);
  }
}

export async function createWhatsAppProvider(config: ConfigResolver): Promise<WhatsAppProvider> {
  const provider = ((await config.get('WHATSAPP_PROVIDER', 'gateway.whatsapp.provider')) || 'mock')
    .toLowerCase()
    .trim();

  try {
    switch (provider) {
      case 'baileys':
        return new BaileysWhatsAppProvider();
      case 'mock':
        return new MockWhatsAppProvider();
      default:
        logger.warn(`Unknown WHATSAPP_PROVIDER "${provider}" — falling back to mock driver.`);
        return new MockWhatsAppProvider();
    }
  } catch (err: any) {
    const reason = err?.message || String(err);
    logger.error(`WhatsApp provider "${provider}" failed to initialise: ${reason}`);
    logger.error('WhatsApp dispatch is DISABLED until this is fixed. Sends will be recorded as FAILED.');
    return new UnavailableWhatsAppProvider(`WhatsApp provider "${provider}" is unavailable: ${reason}`);
  }
}

/** Called at bootstrap to bring the WhatsApp socket up when Baileys is selected. */
export async function bootstrapWhatsApp(config: ConfigResolver): Promise<void> {
  const provider = ((await config.get('WHATSAPP_PROVIDER', 'gateway.whatsapp.provider')) || '')
    .toLowerCase()
    .trim();
  if (provider !== 'baileys') return;

  try {
    await getBaileysGateway().start();
    logger.log('WhatsApp (Baileys) gateway bootstrapped.');
  } catch (err: any) {
    logger.error(`WhatsApp gateway failed to start: ${err?.message || err}`);
    logger.error('Sending WhatsApp will report FAILED until the session is paired.');
  }
}
