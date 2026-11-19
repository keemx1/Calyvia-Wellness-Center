'use client';

import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  KeyRound,
  ShieldAlert,
  Copy,
} from 'lucide-react';

interface GatewaySettingsViewProps {
  token: string | null;
  apiUrl: string;
}

interface GatewaySetting {
  key: string;
  envVar: string;
  label: string;
  group: 'SMS' | 'WHATSAPP';
  description: string;
  secret: boolean;
  options?: string[];
  placeholder?: string;
  value: string;
  source: 'env' | 'database' | 'unset';
  hasValue: boolean;
}

interface WhatsAppStatus {
  status: string;
  connected: boolean;
  qr: string | null;
  pairingCode: string | null;
  authDir: string;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  open: { label: 'Connected', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  awaiting_qr: { label: 'Awaiting pairing', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  connecting: { label: 'Connecting…', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  disconnected: { label: 'Disconnected', className: 'bg-surface-subtle text-muted-foreground border-border' },
  closed: { label: 'Logged out', className: 'bg-danger-soft text-danger border-danger/20' },
};

export const GatewaySettingsView: React.FC<GatewaySettingsViewProps> = ({ token, apiUrl }) => {
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<GatewaySetting[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pairPhone, setPairPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchWhatsAppStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/communication/whatsapp/status`, { headers: authHeaders });
      if (res.ok) {
        const data: WhatsAppStatus = await res.json();
        setWaStatus(data);
        if (data.qr) {
          try {
            setQrDataUrl(await QRCode.toDataURL(data.qr, { width: 280, margin: 2, errorCorrectionLevel: 'M' }));
          } catch {
            setQrDataUrl(null);
          }
        } else {
          setQrDataUrl(null);
        }
      }
    } catch (err) {
      console.warn('WhatsApp status fetch error:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, apiUrl]);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/system-admin/gateway-settings`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSettings(Array.isArray(data) ? data : []);
      } else if (res.status === 403) {
        setMsg({ type: 'error', text: 'Gateway settings require a SUPER_ADMIN account.' });
      }
    } catch (err) {
      console.warn('Gateway settings fetch error:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, apiUrl]);

  useEffect(() => {
    fetchWhatsAppStatus();
    fetchSettings();
    // Poll the WhatsApp session so the QR appears without a manual refresh.
    const t = setInterval(fetchWhatsAppStatus, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchWhatsAppStatus, fetchSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setMsg(null);
    try {
      const entries = Object.entries(draft).map(([key, value]) => ({ key, value }));
      const res = await fetch(`${apiUrl}/system-admin/gateway-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ entries }),
      });
      if (res.ok) {
        const results = await res.json();
        const ignored = (results || []).filter((r: any) => !r.stored).length;
        setMsg({
          type: ignored ? 'error' : 'success',
          text: ignored
            ? `Saved, but ${ignored} setting(s) were ignored because the environment variable takes precedence (managed in Coolify).`
            : 'Gateway settings saved. They take effect on the next message.',
        });
        setDraft({});
        fetchSettings();
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg({ type: 'error', text: err.message || 'Failed to save gateway settings.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error saving gateway settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !pairPhone.trim()) return;
    setPairing(true);
    setMsg(null);
    try {
      const res = await fetch(
        `${apiUrl}/communication/whatsapp/pair?phone=${encodeURIComponent(pairPhone.trim())}`,
        { method: 'POST', headers: authHeaders },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.pairingCode) {
        setWaStatus((prev) => (prev ? { ...prev, pairingCode: data.pairingCode } : prev));
        setMsg({ type: 'success', text: 'Pairing code generated. Enter it on the phone under Linked devices → Link with phone number.' });
      } else {
        setMsg({ type: 'error', text: data.message || data.error || 'Failed to generate a pairing code.' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error requesting pairing code.' });
    } finally {
      setPairing(false);
    }
  };

  const statusStyle = waStatus ? STATUS_STYLES[waStatus.status] ?? STATUS_STYLES.disconnected : null;
  const grouped = {
    SMS: settings.filter((s) => s.group === 'SMS'),
    WHATSAPP: settings.filter((s) => s.group === 'WHATSAPP'),
  };

  return (
    <div className="space-y-6 pt-3">
      {/* ToS / ban risk warning */}
      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-700 space-y-1">
          <p className="font-semibold">WhatsApp runs on an unofficial client (Baileys).</p>
          <p>
            This violates WhatsApp&rsquo;s Terms of Service for automated messaging and the linked
            number <strong>can be banned</strong>. Keep SMS as the channel of record for anything
            clinically critical. See <code className="font-mono">docs/runbooks/whatsapp-ban-risk.md</code>.
          </p>
        </div>
      </div>

      {/* ---------------- WhatsApp pairing ---------------- */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-bold text-foreground flex items-center space-x-2">
              <Smartphone className="w-5 h-5 text-primary" />
              <span>WhatsApp Session</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scan the QR code with WhatsApp → Linked devices to connect the clinic number.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {statusStyle && (
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${statusStyle.className}`}>
                {statusStyle.label}
              </span>
            )}
            <button
              onClick={fetchWhatsAppStatus}
              className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-surface-subtle transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QR */}
          <div className="rounded-xl border border-border bg-surface-subtle p-6 flex flex-col items-center justify-center min-h-[320px]">
            {qrDataUrl ? (
              <>
                <img src={qrDataUrl} alt="WhatsApp pairing QR code" className="rounded-lg bg-white p-2" />
                <p className="text-[11px] text-muted-foreground mt-3 text-center">
                  Open WhatsApp on the phone → <strong>Linked devices</strong> → <strong>Link a device</strong>
                </p>
              </>
            ) : waStatus?.status === 'open' ? (
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                <p className="text-sm font-semibold text-foreground">WhatsApp is connected</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  No pairing needed. Session stored in{' '}
                  <code className="font-mono">{waStatus.authDir}</code>
                </p>
              </div>
            ) : (
              <div className="text-center">
                <QrCode className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-semibold text-foreground">No QR code yet</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Set the WhatsApp provider to <code className="font-mono">baileys</code> below, then
                  restart the API and refresh.
                </p>
              </div>
            )}
          </div>

          {/* Pairing code */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-4 space-y-2">
              <h4 className="text-xs font-semibold text-foreground flex items-center space-x-1.5">
                <KeyRound className="w-4 h-4 text-primary" />
                <span>Headless pairing (no QR scan)</span>
              </h4>
              <p className="text-[11px] text-muted-foreground">
                For a server without a screen. Enter the number to link, then type the code into the
                phone under Linked devices → Link with phone number.
              </p>
              <form onSubmit={handlePair} className="flex items-center space-x-2">
                <input
                  type="tel"
                  value={pairPhone}
                  onChange={(e) => setPairPhone(e.target.value)}
                  placeholder="0712345678"
                  className="flex-1 px-3 py-2 rounded-xl border border-border bg-surface-subtle text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="submit"
                  disabled={pairing || !pairPhone.trim()}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover disabled:opacity-50 transition"
                >
                  {pairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  <span>{pairing ? 'Generating…' : 'Get code'}</span>
                </button>
              </form>

              {waStatus?.pairingCode && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-subtle border border-border">
                  <span className="font-mono text-lg font-bold tracking-widest text-foreground">
                    {waStatus.pairingCode}
                  </span>
                  <button
                    onClick={() => navigator.clipboard?.writeText(waStatus.pairingCode || '')}
                    className="p-2 rounded-lg hover:bg-border transition"
                    title="Copy code"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border p-4 space-y-1">
              <h4 className="text-xs font-semibold text-foreground">Session persistence</h4>
              <p className="text-[11px] text-muted-foreground">
                The login session is saved to{' '}
                <code className="font-mono">{waStatus?.authDir || '.baileys-auth'}</code>. This
                directory <strong>is a credential</strong> — it must survive deploys and must never be
                committed to git.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Gateway settings ---------------- */}
      <form onSubmit={handleSave} className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-5">
        <div>
          <h3 className="font-serif text-lg font-bold text-foreground">Gateway Credentials</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Values are stored encrypted in <code className="font-mono">system_settings</code>. An
            environment variable, when set in Coolify, always wins and cannot be edited here.
          </p>
        </div>

        {msg && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
              msg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                : 'bg-danger-soft border-danger/20 text-danger'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-2" />
            <span>Loading gateway settings…</span>
          </div>
        ) : (
          <>
            {(['SMS', 'WHATSAPP'] as const).map((group) => (
              <div key={group} className="space-y-3">
                <h4 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  {group === 'SMS' ? 'SMS Gateway' : 'WhatsApp Gateway'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {grouped[group].map((s) => (
                    <div key={s.key} className="space-y-1.5">
                      <label className="flex items-center justify-between text-xs font-semibold text-foreground">
                        <span>{s.label}</span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                            s.source === 'env'
                              ? 'bg-primary-soft text-primary'
                              : s.source === 'database'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-surface-subtle text-muted-foreground'
                          }`}
                          title={
                            s.source === 'env'
                              ? `Managed by ${s.envVar} in the deployment environment`
                              : s.source === 'database'
                                ? 'Stored in system_settings'
                                : 'Not configured'
                          }
                        >
                          {s.source === 'env' ? 'ENV' : s.source === 'database' ? 'DB' : 'UNSET'}
                        </span>
                      </label>

                      {s.options ? (
                        <select
                          value={draft[s.key] ?? s.value}
                          disabled={s.source === 'env'}
                          onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-border bg-surface-subtle text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                        >
                          {(draft[s.key] ?? s.value) === '' && (
                            <option value="">— not set —</option>
                          )}
                          {s.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={s.secret ? 'password' : 'text'}
                          value={draft[s.key] ?? s.value}
                          disabled={s.source === 'env'}
                          placeholder={s.secret && s.hasValue ? '••••••••  (unchanged)' : s.placeholder}
                          onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-border bg-surface-subtle text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                        />
                      )}

                      <p className="text-[10px] text-muted-foreground leading-relaxed">{s.description}</p>
                      {s.source === 'env' && (
                        <p className="text-[10px] text-amber-600">
                          Locked: <code className="font-mono">{s.envVar}</code> is set in Coolify and
                          takes precedence. Change it there and redeploy.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground">
                Leave a secret blank to keep its current value.
              </p>
              <button
                type="submit"
                disabled={saving || Object.keys(draft).length === 0}
                className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover disabled:opacity-50 transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{saving ? 'Saving…' : 'Save gateway settings'}</span>
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};
