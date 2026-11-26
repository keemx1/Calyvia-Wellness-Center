import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_SMS_TEMPLATES,
  SMS_TEMPLATE_SETTING_KEY,
  listSmsTemplates,
  renderSmsTemplate,
  resolveSmsTemplateBody,
  saveSmsTemplates,
} from './sms-templates';

function makeSettings(initial: string | null = null) {
  const db: Record<string, string> = {};
  if (initial) db[SMS_TEMPLATE_SETTING_KEY] = initial;
  return {
    readSetting: jest.fn(async (k: string) => db[k] ?? null),
    set: jest.fn(async (k: string, v: string) => {
      db[k] = v;
      return { key: k, stored: true, isEncrypted: false };
    }),
  } as any;
}

describe('SMS templates', () => {
  it('ships a format for every clinical and administrative SMS use case', () => {
    const keys = DEFAULT_SMS_TEMPLATES.map((t) => t.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'WELCOME',
        'ADMISSION_CONFIRMATION',
        'APPOINTMENT_REMINDER',
        'INVOICE_ISSUED',
        'PAYMENT_RECEIPT',
        'PAYMENT_REMINDER',
        'DISCHARGE_SUMMARY',
        'AFTERCARE_CHECKIN',
        'FEEDBACK_SURVEY',
        'FAMILY_BROADCAST',
        'GENERAL',
      ]),
    );
    expect(keys.length).toBeGreaterThanOrEqual(18);
  });

  it('renders every placeholder with a supplied value', () => {
    const text = renderSmsTemplate(
      { key: 'WELCOME', body: 'Hi {{ patient_name }} from {{facility}}!' },
      { patient_name: ' Hannah ', facility: 'Calyvia' },
    );
    expect(text).toBe('Hi Hannah from Calyvia!');
  });

  it('fails loudly when a required value is missing', () => {
    expect(() =>
      renderSmsTemplate({ key: 'WELCOME', body: 'Hi {{patient_name}}, call {{phone}}' }, {}),
    ).toThrow(BadRequestException);
    expect(() =>
      renderSmsTemplate({ key: 'WELCOME', body: 'Hi {{patient_name}}, call {{phone}}' }, {}),
    ).toThrow(/patient_name.*phone/);
  });

  it('returns built-in defaults when nothing has been saved', async () => {
    const templates = await listSmsTemplates(makeSettings());
    expect(templates).toHaveLength(DEFAULT_SMS_TEMPLATES.length);
    expect(templates[0].body).toBe(DEFAULT_SMS_TEMPLATES[0].body);
  });

  it('layers saved edits over defaults without losing newer templates', async () => {
    const settings = makeSettings(
      JSON.stringify([{ key: 'WELCOME', body: 'Karibu {{patient_name}}!', enabled: false }]),
    );
    const templates = await listSmsTemplates(settings);
    const welcome = templates.find((t) => t.key === 'WELCOME')!;
    const discharge = templates.find((t) => t.key === 'DISCHARGE_SUMMARY')!;

    expect(welcome.body).toBe('Karibu {{patient_name}}!');
    expect(welcome.enabled).toBe(false);
    expect(welcome.label).toBe(DEFAULT_SMS_TEMPLATES[0].label);
    expect(discharge.body).toBeTruthy();
  });

  it('preserves custom operator templates alongside the defaults', async () => {
    const settings = makeSettings(
      JSON.stringify([{ key: 'CUSTOM_NOTICE', body: 'Notice for {{patient_name}}' }]),
    );
    const templates = await listSmsTemplates(settings);
    expect(templates.find((t) => t.key === 'CUSTOM_NOTICE')?.body).toBe(
      'Notice for {{patient_name}}',
    );
  });

  it('rejects corrupt stored JSON with an actionable message', async () => {
    await expect(listSmsTemplates(makeSettings('{oops'))).rejects.toThrow(/corrupt/i);
  });

  it('validates and persists edits', async () => {
    const settings = makeSettings();
    const saved = await saveSmsTemplates(settings, [
      { key: 'welcome', body: 'Hello {{patient_name}}' },
    ]);

    expect(saved.find((t) => t.key === 'WELCOME')?.body).toBe('Hello {{patient_name}}');
    expect((settings as any).set).toHaveBeenCalledWith(
      SMS_TEMPLATE_SETTING_KEY,
      expect.any(String),
      expect.any(Object),
    );
  });

  it('rejects duplicate keys and empty bodies', async () => {
    const settings = makeSettings();
    await expect(
      saveSmsTemplates(settings, [
        { key: 'WELCOME', body: 'One' },
        { key: 'WELCOME', body: 'Two' },
      ]),
    ).rejects.toThrow(/Duplicate/);
    await expect(
      saveSmsTemplates(settings, [{ key: 'WELCOME', body: '   ' }]),
    ).rejects.toThrow(/non-empty/);
  });

  it('refuses to render a disabled template', async () => {
    const settings = makeSettings(
      JSON.stringify([
        { key: 'APPOINTMENT_REMINDER', body: 'Hi {{patient_name}}', enabled: false },
      ]),
    );
    await expect(
      resolveSmsTemplateBody(settings, 'APPOINTMENT_REMINDER', { patient_name: 'Hannah' }),
    ).rejects.toThrow(/disabled/);
  });

  it('resolves a template key into the exact outbound body', async () => {
    const settings = makeSettings();
    const body = await resolveSmsTemplateBody(settings, 'welcome', {
      patient_name: 'Hannah',
      facility: 'Calyvia Wellness Center',
      phone: '+254700534306',
    });
    expect(body).toContain('Hannah');
    expect(body).not.toContain('{{');
  });
});
