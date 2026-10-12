'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Plus,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  Clock,
  User,
  ShieldCheck,
} from 'lucide-react';

interface IncidentsViewProps {
  token: string | null;
  apiUrl: string;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({ token, apiUrl }) => {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    title: '',
    category: 'BEHAVIORAL_ESCALATION',
    severity: 'MEDIUM',
    description: '',
    immediateAction: '',
    reportedBy: 'Staff On Duty',
  });

  const fetchIncidents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/incidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIncidents(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Incidents fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Incident log securely submitted for clinical director review.' });
        setIsModalOpen(false);
        setForm({
          title: '',
          category: 'BEHAVIORAL_ESCALATION',
          severity: 'MEDIUM',
          description: '',
          immediateAction: '',
          reportedBy: 'Staff On Duty',
        });
        fetchIncidents();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMsg({ type: 'error', text: err.message || 'Failed to report incident.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error submitting report.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-foreground">
              Incidents & Quality Risk Management
            </h2>
            <p className="text-xs text-muted-foreground">
              Clinical adverse events, medical transfers, absconding reports, and corrective actions
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-danger text-white text-xs font-semibold rounded-xl hover:bg-danger/90 shadow-xs transition"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Report Critical Incident</span>
          </button>
        </div>

        {feedbackMsg && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                : 'bg-danger-soft border-danger/20 text-danger'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-border mt-3">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="px-4 py-3">Incident Title & Type</th>
                <th className="px-4 py-3">Severity Rating</th>
                <th className="px-4 py-3">Reported By</th>
                <th className="px-4 py-3">Immediate Containment Action</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">MDT Review Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && incidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-2" />
                    <span>Loading confidential incident register...</span>
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                    <ShieldCheck className="w-6 h-6 mx-auto text-emerald-500 mb-2" />
                    <p className="font-semibold text-foreground">Zero critical incidents recorded</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Facility safety and patient stabilization operating under normal clinical parameters.
                    </p>
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-surface-subtle transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{inc.title}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{inc.category || inc.incidentType}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          inc.severity === 'CRITICAL' || inc.severity === 'HIGH'
                            ? 'bg-danger-soft text-danger border border-danger/20'
                            : 'bg-warning-soft text-warning border border-warning/20'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{inc.reportedBy}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {inc.immediateAction || inc.immediateActionTaken || 'Documented'}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {inc.createdAt ? new Date(inc.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface border border-border text-foreground">
                        {inc.status || 'UNDER_REVIEW'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="font-serif text-lg font-bold text-foreground">Report Incident or Safety Risk</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-foreground font-semibold mb-1">Incident Headline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Patient experiencing severe tremors / suspected delirium tremens"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Classification</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  >
                    <option value="BEHAVIORAL_ESCALATION">Behavioral Escalation</option>
                    <option value="MEDICAL_EMERGENCY">Medical Crisis / Transfer</option>
                    <option value="CONTRABAND_DISCOVERY">Contraband Discovery</option>
                    <option value="ABSCONDING_ATTEMPT">Unauthorized Leave / Absconding</option>
                    <option value="MEDICATION_ERROR">Medication Discrepancy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Severity</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  >
                    <option value="LOW">Low (Minor anomaly)</option>
                    <option value="MEDIUM">Medium (Requires attention)</option>
                    <option value="HIGH">High (Immediate medical intervention)</option>
                    <option value="CRITICAL">Critical (Life safety / Transfer)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Incident Narrative</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Factual details: what occurred, location, individuals involved..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Immediate Containment Action Taken</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Escorted to detox station, doctor alerted, vitals recorded"
                  value={form.immediateAction}
                  onChange={(e) => setForm({ ...form, immediateAction: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-xl text-foreground font-medium hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-danger text-white rounded-xl font-semibold hover:bg-danger/90 shadow-xs flex items-center space-x-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit Incident Report</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
