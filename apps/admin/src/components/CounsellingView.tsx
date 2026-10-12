'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  HeartHandshake,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  FileText,
} from 'lucide-react';

interface CounsellingViewProps {
  token: string | null;
  apiUrl: string;
}

export const CounsellingView: React.FC<CounsellingViewProps> = ({ token, apiUrl }) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    patientId: '',
    sessionType: 'INDIVIDUAL',
    therapistName: 'Counsellor David',
    durationMins: 60,
    sessionNotes: '',
    goalsAddressed: '',
  });

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.append('search', search);
      if (typeFilter !== 'ALL') q.append('sessionType', typeFilter);

      const res = await fetch(`${apiUrl}/counselling/sessions?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Failed to fetch counselling sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl, search, typeFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${apiUrl}/counselling/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientId: form.patientId || undefined,
          sessionType: form.sessionType,
          therapistName: form.therapistName,
          durationMins: Number(form.durationMins),
          sessionNotes: form.sessionNotes,
          goalsAddressed: form.goalsAddressed,
        }),
      });

      if (res.ok) {
        setSuccessMsg('Therapy session logged successfully.');
        setIsModalOpen(false);
        setForm({
          patientId: '',
          sessionType: 'INDIVIDUAL',
          therapistName: 'Counsellor David',
          durationMins: 60,
          sessionNotes: '',
          goalsAddressed: '',
        });
        fetchSessions();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.message || 'Failed to record therapy session.');
      }
    } catch {
      setErrorMsg('Network error connecting to counselling service.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = sessions.filter((s) => {
    const term = search.toLowerCase();
    const matchesSearch =
      (s.counsellorName || s.therapistName || '').toLowerCase().includes(term) ||
      (s.patient?.firstName || '').toLowerCase().includes(term) ||
      (s.patient?.lastName || '').toLowerCase().includes(term) ||
      (s.sessionType || '').toLowerCase().includes(term);
    const matchesType = typeFilter === 'ALL' || s.sessionType === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-foreground">
              Counselling & Psychotherapy Management
            </h2>
            <p className="text-xs text-muted-foreground">
              Individual CBT, group therapy, 12-step dynamics, and family reunification records
            </p>
          </div>
          <button
            onClick={() => {
              setErrorMsg(null);
              setSuccessMsg(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Log Therapy Session</span>
          </button>
        </div>

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by therapist, patient, or modality..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-subtle border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-surface-subtle border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
          >
            <option value="ALL">All Session Modalities</option>
            <option value="INDIVIDUAL">Individual CBT / 1-on-1</option>
            <option value="GROUP">Group Therapy</option>
            <option value="FAMILY">Family Reunification</option>
            <option value="PSYCHOEDUCATION">Psychoeducation</option>
          </select>
        </div>

        {/* Sessions Table */}
        <div className="overflow-x-auto rounded-xl border border-border mt-3">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Modality</th>
                <th className="px-4 py-3">Therapist</th>
                <th className="px-4 py-3">Patient / Group</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Clinical Progress Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-2" />
                    <span>Loading therapy sessions...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                    <HeartHandshake className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-semibold text-foreground">
                      {search || typeFilter !== 'ALL'
                        ? 'No therapy sessions match your search criteria'
                        : 'No therapy sessions recorded yet'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {search || typeFilter !== 'ALL'
                        ? 'Try clearing or modifying your filters.'
                        : 'Click "Log Therapy Session" above to document a clinical counseling encounter.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-subtle transition-colors">
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {s.sessionDate || s.scheduledAt
                        ? new Date(s.sessionDate || s.scheduledAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-soft text-primary">
                        {s.sessionType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {s.counsellorName || s.therapistName || 'Counsellor'}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {s.patient ? `${s.patient.firstName} ${s.patient.lastName}` : s.patientId || 'Group Cohort'}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {s.durationMinutes || s.durationMins || 60} mins
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {s.notesEncrypted || s.sessionNotes || s.goalsProgressEncrypted || 'Confidential MDT Note'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="font-serif text-lg font-bold text-foreground">Log Therapy Session</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Session Modality</label>
                  <select
                    value={form.sessionType}
                    onChange={(e) => setForm({ ...form, sessionType: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="INDIVIDUAL">Individual CBT / 1-on-1</option>
                    <option value="GROUP">Group Therapy</option>
                    <option value="FAMILY">Family Reunification</option>
                    <option value="PSYCHOEDUCATION">Psychoeducation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={form.durationMins}
                    onChange={(e) => setForm({ ...form, durationMins: Number(e.target.value) })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Therapist / Lead Counsellor</label>
                <input
                  type="text"
                  required
                  value={form.therapistName}
                  onChange={(e) => setForm({ ...form, therapistName: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Goals Addressed</label>
                <input
                  type="text"
                  placeholder="e.g. Relapse prevention triggers, emotional regulation, family reconciliation"
                  value={form.goalsAddressed}
                  onChange={(e) => setForm({ ...form, goalsAddressed: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Session Notes (KDPA Encrypted)</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Clinical observations, interventions utilized, client response..."
                  value={form.sessionNotes}
                  onChange={(e) => setForm({ ...form, sessionNotes: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none focus:border-primary"
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
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary-hover shadow-xs flex items-center space-x-1.5 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Therapy Note</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
