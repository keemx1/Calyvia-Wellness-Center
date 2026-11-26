/**
 * Contract for resolving a gateway configuration value.
 *
 * Implemented by `SystemSettingsService`. Providers depend on this interface rather
 * than on `process.env` directly so that configuration can come from the deployment
 * environment *or* from operator-editable `system_settings` rows — whichever the
 * resolver decides wins.
 */
export interface ConfigResolver {
  /**
   * @param envVar      Environment variable name (e.g. 'BYTEWAVE_API_KEY')
   * @param settingKey  system_settings.setting_key (e.g. 'gateway.sms.bytewave.api_key')
   * @returns the resolved value, or undefined when configured nowhere
   */
  get(envVar: string, settingKey: string): Promise<string | undefined>;
}

/**
 * The `mock` SMS driver only exists for local development and automated tests.
 * A production deployment must never emit synthetic deliveries, so any other
 * value (including a stale `SMS_PROVIDER=mock` left in Coolify) resolves to
 * ByteWave there. This keeps the gateway honest without a redeploy just to
 * change an environment variable.
 */
export function resolveSmsProviderName(value: string | undefined | null): string {
  const raw = (value || '').trim().toLowerCase();
  if (process.env.NODE_ENV === 'production' && raw !== 'bytewave') return 'bytewave';
  return raw;
}

/** No-op resolver used in unit tests. */
export class NullConfigResolver implements ConfigResolver {
  constructor(private readonly values: Record<string, string | undefined> = {}) {}
  async get(envVar: string, settingKey: string): Promise<string | undefined> {
    return this.values[settingKey] ?? this.values[envVar];
  }
}
