'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  RotateCcw,
  Save,
  Send,
} from 'lucide-react';

interface SmsTemplatesViewProps {
  token: string | null;
  apiUrl: string;
  /** Template edits are restricted to SUPER_ADMIN by the API. */
  canEdit?: boolean;
  /** Pre-fill the "Send communication" dialog with a rendered template. */
  onUseTemplate?: (body: string) => void;
}

interface SmsTemplate {
  key: string;
  label: string;
  category: string;
  description: string;
  body: string;
  variables: string[];
  enabled: boolean;
}

const SAMPLE_VALUES: Record<string, string> = {
  patient_name: 'Hannah',
  caregiver_name: 'Mary',
  facility: 'Calyvia Wellness Center',
  phone: '+254700534306',
  date: '27 Nov 2026',
  time: '8:00 AM',
  staff_name: 'Nurse Achieng',
  appointment_date: '27 Nov 2026 at 10:00 AM',
  invoice_number: 'INV-2026-1042',
  amount_due: '12,500',
  amount_paid: '5,000',
  balance: '7,500',
  room: 'Room 2',
  bed: 'Bed 2A',
  program: 'Residential Rehabilitation',
  diagnosis: 'Substance use disorder',
  survey_link: 'https://calyviawellness.co.ke/feedback',
  message: 'Your family therapy session is confirmed.',
};

const CATEGORY_LABELS: Record<string, string> = {
  ADMISSION: 'Admission & Welcome',
  APPOINTMENT: 'Appointments & Therapy',
  BILLING: 'Billing & Payments',
  DISCHARGE: 'Discharge',
  FOLLOW_UP: 'Aftercare & Follow-up',
  FAMILY: 'Family & Community',
  GENERAL: 'General',
};

export const SmsTemplatesView: React.FC<SmsTemplatesViewProps> = ({
  token,
  apiUrl,
  canEdit = false,
  onUseTemplate,
}) => {
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [sampleVars, setSampleVars] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };
  const selected = templates.find((t) => t.key === selectedKey) ?? templates[0] ?? null;
  const variables = selected?.variables ?? [];

  const applyTemplates = useCallback((rows: SmsTemplate[]) => {
    setTemplates(rows);
    setSelectedKey((current) => current || rows[0]?.key || '');
    setDrafts(Object.fromEntries(rows.map((t) => [t.key, t.body])));
    setEnabled(Object.fromEntries(rows.map((t) => [t.key, t.enabled])));
    setSampleVars(
      Object.fromEntries(
        rows.flatMap((t) =>
          t.variables.map((v) => [v, SAMPLE_VALUES[v] ?? ''] as [string, string]),
        ),
      ),
    );
  }, []);

  const fetchTemplates = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/communication/sms-templates`, { headers: authHeaders });
      if (res.ok) {
        applyTemplates(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg({ type: 'error', text: err.message || 'Could not load SMS templates.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error loading SMS templates.' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, apiUrl, applyTemplates]);

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTemplates]);

  useEffect(() => {
    setPreview('');
  }, [selectedKey, drafts, sampleVars]);

  const grouped = useMemo(() => {
    const map = new Map<string, SmsTemplate[]>();
    for (const t of templates) {
      map.set(t.category, [...(map.get(t.category) ?? []), t]);
    }
    return Array.from(map.entries());
  }, [templates]);

  const handlePreview = async () => {
    if (!selected) return;
    setMsg(null);
    try {
      const res = await fetch(`${apiUrl}/communication/sms-templates/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ key: selected.key, variables: sampleVars }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPreview(data.body || '');
      } else {
        setMsg({ type: 'error', text: data.message || 'Could not preview this template.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error previewing template.' });
    }
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload = templates.map((t) => ({
        key: t.key,
        label: t.label,
        body: drafts[t.key] ?? t.body,
        enabled: enabled[t.key] !== false,
        variables: t.variables,
      }));
      const res = await fetch(`${apiUrl}/communication/sms-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ templates: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        applyTemplates(data);
        setMsg({
          type: 'success',
          text: `${payload.length} SMS formats saved. The next dispatch uses these texts.`,
        });
      } else if (res.status === 403) {
        setMsg({ type: 'error', text: 'Only a SUPER_ADMIN can edit SMS templates.' });
      } else {
        setMsg({ type: 'error', text: data.message || 'Failed to save SMS templates.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error saving SMS templates.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!token || !window.confirm('Restore all built-in SMS texts and discard your edits?')) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiUrl}/communication/sms-templates/reset`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        applyTemplates(data);
        setMsg({ type: 'success', text: 'Built-in SMS formats restored.' });
      } else {
        setMsg({ type: 'error', text: data.message || 'Could not reset templates.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error resetting templates.' });
    } finally {
      setSaving(false);
    }
  };

  const handleUse = async () => {
    if (!selected) return;
    await handlePreview();
    // Preview is async; render locally as well so the button is immediate.
    const rendered = selected.body.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_m, name: string) =>
      sampleVars[name] ? sampleVars[name] : `{{${name}}}`,
    );
    onUseTemplate?.(rendered);
  };

  return (
    <div className="pt-3 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="font-serif text-base font-bold text-foreground">SMS Message Templates</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {canEdit
              ? 'Edit every outbound format — welcome, admission, billing, discharge, reminders and aftercare. Changes take effect on the next message.'
              : 'Read-only view of every outbound format. Only a SUPER_ADMIN can edit templates; previews and sending are available to all authenticated users.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTemplates}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium text-foreground hover:bg-surface-elevated disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Refresh
          </button>
          {canEdit && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium text-foreground hover:bg-surface-elevated disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" /> Defaults
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div
          className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
            msg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
              : 'bg-danger/10 border-danger/20 text-danger'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-primary" />
          Loading SMS formats…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.4fr)] gap-4">
          {/* Template catalogue */}
          <div className="rounded-xl border border-border bg-surface-subtle max-h-[560px] overflow-y-auto">
            {grouped.map(([category, rows]) => (
              <div key={category}>
                <div className="sticky top-0 bg-surface-elevated px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                  {CATEGORY_LABELS[category] ?? category}
                </div>
                {rows.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setSelectedKey(t.key)}
                    className={`w-full text-left px-3 py-2.5 border-b border-border/60 transition-colors ${
                      t.key === selected?.key ? 'bg-primary-soft' : 'hover:bg-surface-elevated'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">{t.label}</span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          enabled[t.key] !== false ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                        }`}
                        title={enabled[t.key] !== false ? 'Enabled' : 'Disabled'}
                      />
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground">{t.key}</div>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Editor */}
          {selected && (
            <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{selected.label}</h4>
                  <p className="text-[11px] text-muted-foreground">{selected.description}</p>
                </div>
                <label className="flex items-center gap-2 text-[11px] font-medium text-foreground shrink-0">
                  <input
                    type="checkbox"
                    checked={enabled[selected.key] !== false}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setEnabled((prev) => ({ ...prev, [selected.key]: e.target.checked }))
                    }
                    className="accent-primary disabled:opacity-50"
                  />
                  Active
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-foreground">Message text</label>
                  <span className="text-[10px] text-muted-foreground">
                    {(drafts[selected.key] ?? selected.body).length} chars
                  </span>
                </div>
                <textarea
                  rows={5}
                  readOnly={!canEdit}
                  value={drafts[selected.key] ?? selected.body}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [selected.key]: e.target.value }))
                  }
                  className="w-full bg-surface-subtle border border-border rounded-xl p-3 text-xs text-foreground font-mono focus:outline-none focus:border-primary read-only:opacity-80"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Use{' '}
                  <code className="font-mono text-primary">
                    {variables.map((v) => `{{${v}}}`).join(' ')}
                  </code>{' '}
                  — values are filled automatically when the message is sent from records.
                </p>
              </div>

              {variables.length > 0 && (
                <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground">Preview values</span>
                    <span className="text-[10px] text-muted-foreground">
                      Used only for testing this text
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {variables.map((v) => (
                      <div key={v}>
                        <label className="block text-[10px] text-muted-foreground font-mono mb-0.5">
                          {`{{${v}}}`}
                        </label>
                        <input
                          value={sampleVars[v] ?? ''}
                          onChange={(e) =>
                            setSampleVars((prev) => ({ ...prev, [v]: e.target.value }))
                          }
                          className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-primary/20 bg-primary-soft/40 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-semibold text-foreground">Preview</span>
                </div>
                <p className="text-xs text-foreground whitespace-pre-wrap min-h-[2.5rem]">
                  {preview ||
                    'Click "Preview" to see the exact text with the values above filled in.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  onClick={handlePreview}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium text-foreground hover:bg-surface-elevated"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
                {onUseTemplate && (
                  <button
                    onClick={handleUse}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-primary/30 rounded-xl text-xs font-medium text-primary hover:bg-primary-soft"
                  >
                    <Send className="w-3.5 h-3.5" /> Use in Send
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary-hover disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save all templates
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
