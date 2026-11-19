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

/** No-op resolver used in unit tests. */
export class NullConfigResolver implements ConfigResolver {
  constructor(private readonly values: Record<string, string | undefined> = {}) {}
  async get(envVar: string, settingKey: string): Promise<string | undefined> {
    return this.values[settingKey] ?? this.values[envVar];
  }
}
