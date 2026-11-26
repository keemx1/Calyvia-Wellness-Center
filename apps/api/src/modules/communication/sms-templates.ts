import { BadRequestException } from '@nestjs/common';
import { SystemSettingsService } from '../system-admin/settings.service';

/**
 * Operator-editable SMS message templates.
 *
 * Stored as one JSON value in system_settings so no database migration is
 * needed. `listSmsTemplates` always merges the saved values over the built-in
 * defaults: a new release can add a template without erasing operator edits,
 * and a half-written save can never leave the system with no templates.
 */
export const SMS_TEMPLATE_SETTING_KEY = 'communication.sms_templates';

export type SmsTemplateCategory =
  | 'ADMISSION'
  | 'APPOINTMENT'
  | 'BILLING'
  | 'DISCHARGE'
  | 'FOLLOW_UP'
  | 'FAMILY'
  | 'GENERAL';

export interface SmsTemplate {
  key: string;
  label: string;
  category: SmsTemplateCategory;
  description: string;
  /** Mustache-style {{placeholders}}. */
  body: string;
  variables: string[];
  enabled: boolean;
}

export const SMS_VARIABLE_LABELS: Record<string, string> = {
  patient_name: 'Patient’s first name',
  caregiver_name: 'Caregiver / family contact name',
  facility: 'Facility name',
  phone: 'Facility contact number',
  date: 'Today’s date',
  time: 'Time',
  staff_name: 'Staff member’s name',
  appointment_date: 'Appointment date and time',
  invoice_number: 'Invoice number',
  amount_due: 'Amount due (KES)',
  amount_paid: 'Amount paid (KES)',
  balance: 'Outstanding balance (KES)',
  room: 'Room name / number',
  bed: 'Bed label',
  program: 'Program or service track',
  diagnosis: 'Primary diagnosis',
  survey_link: 'Feedback survey link',
  message: 'Custom message text',
};

export const DEFAULT_SMS_TEMPLATES: SmsTemplate[] = [
  {
    key: 'WELCOME',
    label: 'Welcome / enrolment',
    category: 'ADMISSION',
    description: 'Sent when a client is registered or starts care.',
    body: 'Welcome to {{facility}}, {{patient_name}}. We are glad you have taken this step. Our team will call you shortly with your next steps. Questions? Call {{phone}}.',
    variables: ['patient_name', 'facility', 'phone'],
    enabled: true,
  },
  {
    key: 'ADMISSION_CONFIRMATION',
    label: 'Admission confirmed',
    category: 'ADMISSION',
    description: 'Confirms that the client has been admitted.',
    body: '{{patient_name}}, your admission to {{facility}} is confirmed. Please bring your identification and any current medication. Report to reception on arrival. Call {{phone}} if you need directions.',
    variables: ['patient_name', 'facility', 'phone'],
    enabled: true,
  },
  {
    key: 'ADMISSION_SCHEDULED',
    label: 'Admission scheduled',
    category: 'ADMISSION',
    description: 'Sent when an admission date has been booked.',
    body: 'Hello {{patient_name}}, your admission at {{facility}} is scheduled for {{date}}. Please call {{phone}} to confirm or reschedule.',
    variables: ['patient_name', 'facility', 'date', 'phone'],
    enabled: true,
  },
  {
    key: 'BED_ASSIGNED',
    label: 'Room / bed assigned',
    category: 'ADMISSION',
    description: 'Sent after a bed allocation is made.',
    body: '{{patient_name}}, you have been allocated {{bed}} in {{room}} at {{facility}}. Please report to the nursing station if you need anything.',
    variables: ['patient_name', 'bed', 'room', 'facility'],
    enabled: true,
  },
  {
    key: 'BED_TRANSFER',
    label: 'Room / bed transfer',
    category: 'ADMISSION',
    description: 'Sent when a client is moved to another bed.',
    body: '{{patient_name}}, your room has changed to {{room}}, {{bed}}. Please update your personal belongings accordingly. Contact {{phone}} with any questions.',
    variables: ['patient_name', 'room', 'bed', 'phone'],
    enabled: true,
  },
  {
    key: 'APPOINTMENT_CONFIRMATION',
    label: 'Appointment confirmation',
    category: 'APPOINTMENT',
    description: 'Confirms a booked appointment.',
    body: 'Hello {{patient_name}}, your appointment at {{facility}} is confirmed for {{appointment_date}}. Please arrive 15 minutes early. To reschedule, call {{phone}}.',
    variables: ['patient_name', 'facility', 'appointment_date', 'phone'],
    enabled: true,
  },
  {
    key: 'APPOINTMENT_REMINDER',
    label: 'Appointment reminder',
    category: 'APPOINTMENT',
    description: 'Sent before an upcoming appointment.',
    body: 'Reminder: {{patient_name}}, you have an appointment at {{facility}} on {{appointment_date}}. Please confirm by replying or call {{phone}}.',
    variables: ['patient_name', 'facility', 'appointment_date', 'phone'],
    enabled: true,
  },
  {
    key: 'ASSESSMENT_BOOKED',
    label: 'Assessment booked',
    category: 'APPOINTMENT',
    description: 'Sent when a clinical assessment is scheduled.',
    body: '{{patient_name}}, your clinical assessment at {{facility}} is booked for {{appointment_date}}. Please bring a list of current medications. Questions: {{phone}}.',
    variables: ['patient_name', 'facility', 'appointment_date', 'phone'],
    enabled: true,
  },
  {
    key: 'THERAPY_REMINDER',
    label: 'Therapy session reminder',
    category: 'APPOINTMENT',
    description: 'Sent before a counselling or group therapy session.',
    body: 'Hello {{patient_name}}, your therapy session with {{staff_name}} is at {{appointment_date}}. Please be on time. Call {{phone}} if you cannot attend.',
    variables: ['patient_name', 'staff_name', 'appointment_date', 'phone'],
    enabled: true,
  },
  {
    key: 'MEDICATION_REMINDER',
    label: 'Medication reminder',
    category: 'FOLLOW_UP',
    description: 'Sent to a client or caregiver about scheduled medication.',
    body: '{{patient_name}}, this is a reminder from {{facility}} about your medication at {{time}}. If you have questions, speak to your nurse or call {{phone}}.',
    variables: ['patient_name', 'facility', 'time', 'phone'],
    enabled: true,
  },
  {
    key: 'INVOICE_ISSUED',
    label: 'Invoice issued',
    category: 'BILLING',
    description: 'Sent when a new invoice is raised.',
    body: '{{patient_name}}, invoice {{invoice_number}} for {{amount_due}} has been issued by {{facility}}. Balance due: {{balance}}. Please pay by the due date or call {{phone}} to discuss.',
    variables: ['patient_name', 'invoice_number', 'amount_due', 'balance', 'facility', 'phone'],
    enabled: true,
  },
  {
    key: 'PAYMENT_RECEIPT',
    label: 'Payment receipt',
    category: 'BILLING',
    description: 'Acknowledges a received payment.',
    body: 'Thank you, {{patient_name}}. We received {{amount_paid}} towards invoice {{invoice_number}}. Remaining balance: {{balance}}. Receipt from {{facility}}, {{phone}}.',
    variables: ['patient_name', 'amount_paid', 'invoice_number', 'balance', 'facility', 'phone'],
    enabled: true,
  },
  {
    key: 'PAYMENT_REMINDER',
    label: 'Outstanding balance reminder',
    category: 'BILLING',
    description: 'Sent when an invoice is overdue.',
    body: 'Hello {{patient_name}}, invoice {{invoice_number}} still has a balance of {{balance}}. Please settle at {{facility}} or call {{phone}} to arrange payment.',
    variables: ['patient_name', 'invoice_number', 'balance', 'facility', 'phone'],
    enabled: true,
  },
  {
    key: 'DISCHARGE_SUMMARY',
    label: 'Discharge summary',
    category: 'DISCHARGE',
    description: 'Sent when a client is discharged.',
    body: '{{patient_name}}, you were discharged from {{facility}} on {{date}}. Please follow your aftercare plan and attend your scheduled check-ins. For support, call {{phone}}.',
    variables: ['patient_name', 'facility', 'date', 'phone'],
    enabled: true,
  },
  {
    key: 'AFTERCARE_CHECKIN',
    label: 'Aftercare check-in',
    category: 'FOLLOW_UP',
    description: 'Sent during post-discharge follow-up.',
    body: 'Hello {{patient_name}}, how are you doing since leaving {{facility}}? Reply with a number from 1 (struggling) to 5 (doing well), or call {{phone}} to speak to {{staff_name}}.',
    variables: ['patient_name', 'facility', 'phone', 'staff_name'],
    enabled: true,
  },
  {
    key: 'FEEDBACK_SURVEY',
    label: 'Feedback survey invite',
    category: 'FOLLOW_UP',
    description: 'Invites a client or family member to give feedback.',
    body: '{{patient_name}}, we value your experience at {{facility}}. Please take 2 minutes to share feedback: {{survey_link}}. Thank you — {{phone}}.',
    variables: ['patient_name', 'facility', 'survey_link', 'phone'],
    enabled: true,
  },
  {
    key: 'FAMILY_BROADCAST',
    label: 'Family support broadcast',
    category: 'FAMILY',
    description: 'General update to a caregiver or family contact.',
    body: 'Hello {{caregiver_name}}, this is {{facility}} with an update about {{patient_name}}: {{message}} Call {{phone}} if you need to speak with our team.',
    variables: ['caregiver_name', 'facility', 'patient_name', 'message', 'phone'],
    enabled: true,
  },
  {
    key: 'LEAD_FOLLOW_UP',
    label: 'Enquiry follow-up',
    category: 'FOLLOW_UP',
    description: 'Sent to a prospective client who enquired.',
    body: 'Hello {{patient_name}}, thank you for enquiring about {{facility}}’s {{program}} program. We would love to answer your questions — call {{phone}} at your convenience.',
    variables: ['patient_name', 'facility', 'program', 'phone'],
    enabled: true,
  },
  {
    key: 'GENERAL',
    label: 'General / custom message',
    category: 'GENERAL',
    description: 'Ad-hoc message that does not fit a defined format.',
    body: '{{message}} — {{facility}}. Call {{phone}} for more information.',
    variables: ['message', 'facility', 'phone'],
    enabled: true,
  },
];

interface StoredSmsTemplate {
  key?: unknown;
  label?: unknown;
  category?: unknown;
  description?: unknown;
  body?: unknown;
  variables?: unknown;
  enabled?: unknown;
}

/** Saved edits layered over the built-in defaults. */
export async function listSmsTemplates(settings: SystemSettingsService): Promise<SmsTemplate[]> {
  const raw = await settings.readSetting(SMS_TEMPLATE_SETTING_KEY);
  if (!raw) return DEFAULT_SMS_TEMPLATES.map((t) => ({ ...t, variables: [...t.variables] }));

  let stored: StoredSmsTemplate[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('expected an array');
    stored = parsed;
  } catch {
    throw new Error('Stored SMS templates are corrupt. Reset them to defaults in the admin UI.');
  }

  const byKey = new Map<string, SmsTemplate>(
    DEFAULT_SMS_TEMPLATES.map((t) => [t.key, { ...t, variables: [...t.variables] }]),
  );

  for (const item of stored) {
    if (!item || typeof item.key !== 'string' || !item.key.trim()) continue;
    const key = item.key.trim();
    const base = byKey.get(key);
    byKey.set(key, {
      key,
      label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : base?.label ?? key,
      category: (base?.category ?? 'GENERAL') as SmsTemplateCategory,
      description: base?.description ?? '',
      body: typeof item.body === 'string' ? item.body : base?.body ?? '',
      variables: Array.isArray(item.variables)
        ? item.variables.filter((v): v is string => typeof v === 'string')
        : base?.variables ?? [],
      enabled: item.enabled !== false,
    });
  }

  return [...byKey.values()];
}

/** Validate and persist operator edits. Incomplete entries leave defaults in place. */
export async function saveSmsTemplates(
  settings: SystemSettingsService,
  entries: unknown,
): Promise<SmsTemplate[]> {
  if (!Array.isArray(entries) || entries.length > 100) {
    throw new BadRequestException('Expected an array of at most 100 SMS templates.');
  }

  const seen = new Set<string>();
  const clean = entries.map((raw: any, index: number) => {
    const key = String(raw?.key ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9_]{2,40}$/.test(key)) {
      throw new BadRequestException(`Template #${index + 1} has an invalid key "${raw?.key}".`);
    }
    if (seen.has(key)) throw new BadRequestException(`Duplicate template key "${key}".`);
    seen.add(key);

    if (typeof raw?.body !== 'string' || raw.body.trim().length === 0) {
      throw new BadRequestException(`Template "${key}" needs a non-empty body.`);
    }
    if (raw.body.length > 1000) {
      throw new BadRequestException(`Template "${key}" body is too long (max 1000 characters).`);
    }

    return {
      key,
      body: raw.body,
      enabled: raw.enabled !== false,
      ...(typeof raw.label === 'string' ? { label: raw.label.trim() } : {}),
      ...(Array.isArray(raw.variables)
        ? { variables: raw.variables.filter((v: unknown): v is string => typeof v === 'string') }
        : {}),
    };
  });

  await settings.set(SMS_TEMPLATE_SETTING_KEY, JSON.stringify(clean), {
    description: 'Operator-edited SMS message templates',
  });
  return listSmsTemplates(settings);
}

/** Replace {{placeholders}} in a template, failing loudly on missing values. */
export function renderSmsTemplate(
  template: Pick<SmsTemplate, 'key' | 'body'>,
  variables: Record<string, unknown> = {},
): string {
  const missing = new Set<string>();
  const rendered = template.body.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, name: string) => {
    const value = variables[name];
    if (value === undefined || value === null || String(value).trim() === '') {
      missing.add(name);
      return '';
    }
    return String(value).trim();
  });

  if (missing.size) {
    const names = [...missing].map((n) => `{{${n}}}`).join(', ');
    throw new BadRequestException(
      `Template "${template.key}" is missing required value(s): ${names}.`,
    );
  }
  if (!rendered.trim()) {
    throw new BadRequestException(`Template "${template.key}" rendered an empty message.`);
  }
  return rendered.trim();
}

/** Resolve a template key + variables into the body passed to the SMS driver. */
export async function resolveSmsTemplateBody(
  settings: SystemSettingsService,
  key: string,
  variables: Record<string, unknown> = {},
): Promise<string> {
  const templates = await listSmsTemplates(settings);
  const template = templates.find((t) => t.key === key.toUpperCase());
  if (!template) throw new BadRequestException(`Unknown SMS template "${key}".`);
  if (!template.enabled) throw new BadRequestException(`SMS template "${key}" is disabled.`);
  return renderSmsTemplate(template, variables);
}
