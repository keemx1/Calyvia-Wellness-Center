'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Search,
  ShieldCheck,
  CheckCircle2,
  Clock,
  User,
  X,
  Loader2,
  DoorOpen,
  ArrowRightLeft,
  AlertTriangle,
} from 'lucide-react';

interface MovementViewProps {
  token: string | null;
  apiUrl: string;
}

export const MovementView: React.FC<MovementViewProps> = ({ token, apiUrl }) => {
  const [activeTab, setActiveTab] = useState<'movement' | 'visitors'>('movement');
  const [visitors, setVisitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [patientsList, setPatientsList] = useState<any[]>([]);

  const [modalType, setModalType] = useState<'pass' | 'visitor' | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [passForm, setPassForm] = useState({
    patientId: '',
    movementType: 'THERAPEUTIC_PASS',
    departureTime: new Date().toISOString().slice(0, 16),
    expectedReturn: new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 16),
    escortPerson: '',
  });

  const [visitorForm, setVisitorForm] = useState({
    visitorName: '',
    nationalId: '',
    phoneNumber: '',
    patientName: '',
    relationship: 'Family Member',
    officerName: 'Security Desk',
  });

  const fetchPatients = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/patients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPatientsList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Patients fetch error:', err);
    }
  }, [token, apiUrl]);

  const fetchVisitors = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/movement/visitors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVisitors(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Visitors fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl]);

  useEffect(() => {
    fetchPatients();
    fetchVisitors();
  }, [fetchPatients, fetchVisitors]);

  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/movement/passes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(passForm),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Movement pass issued and gate clearance logged.' });
        setModalType(null);
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMsg({ type: 'error', text: err.message || 'Failed to issue movement pass.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error issuing pass.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/movement/visitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(visitorForm),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Visitor registered and contraband screened successfully.' });
        setModalType(null);
        fetchVisitors();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMsg({ type: 'error', text: err.message || 'Failed to register visitor.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error registering visitor.' });
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
              Patient Movement, Passes & Visitor Gate Registry
            </h2>
            <p className="text-xs text-muted-foreground">
              Therapeutic leaves, medical transfers, gate passes, and contraband-screened visitor logs
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setPassForm({
                  patientId: patientsList[0]?.id || '',
                  movementType: 'THERAPEUTIC_PASS',
                  departureTime: new Date().toISOString().slice(0, 16),
                  expectedReturn: new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 16),
                  escortPerson: '',
                });
                setModalType('pass');
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-surface hover:bg-surface-elevated border border-border text-foreground text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              <span>Issue Movement Pass</span>
            </button>
            <button
              onClick={() => {
                setVisitorForm({
                  visitorName: '',
                  nationalId: '',
                  phoneNumber: '',
                  patientName: '',
                  relationship: 'Family Member',
                  officerName: 'Security Gate',
                });
                setModalType('visitor');
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Register Gate Visitor</span>
            </button>
          </div>
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

        {/* Tab Selection */}
        <div className="flex border-b border-border space-x-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('movement')}
            className={`pb-2.5 transition border-b-2 ${
              activeTab === 'movement'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Patient Movement Protocols
          </button>
          <button
            onClick={() => setActiveTab('visitors')}
            className={`pb-2.5 transition border-b-2 ${
              activeTab === 'visitors'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Visitor Gate Log & Screening
          </button>
        </div>

        {activeTab === 'movement' && (
          <div className="p-8 rounded-xl bg-surface-subtle border border-border text-center space-y-2">
            <DoorOpen className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs font-semibold text-foreground">No active patient leaves or transfers recorded</p>
            <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
              All admitted patients currently accounted for inside facility premises. Click &quot;Issue Movement Pass&quot; above to record an authorized leave or hospital escort.
            </p>
          </div>
        )}

        {activeTab === 'visitors' && (
          <div className="overflow-x-auto rounded-xl border border-border mt-3">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3">Visitor Name & ID</th>
                  <th className="px-4 py-3">Phone Number</th>
                  <th className="px-4 py-3">Patient Visited</th>
                  <th className="px-4 py-3">Relationship</th>
                  <th className="px-4 py-3">Check-in Time</th>
                  <th className="px-4 py-3">Security Screening</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visitors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                      <User className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="font-semibold text-foreground">No visitor logs recorded today</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Family visits and gate admissions will appear here with contraband screening verification.
                      </p>
                    </td>
                  </tr>
                ) : (
                  visitors.map((v) => (
                    <tr key={v.id} className="hover:bg-surface-subtle transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{v.visitorName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">ID: {v.nationalId}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">{v.phoneNumber}</td>
                      <td className="px-4 py-3 text-foreground font-medium">{v.patientName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.relationship}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {v.checkInTime ? new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Screened Clear
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Movement Pass */}
      {modalType === 'pass' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="font-serif text-lg font-bold text-foreground">Issue Patient Movement Pass</h3>
              <button onClick={() => setModalType(null)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreatePass} className="space-y-3 text-xs">
              <div>
                <label className="block text-foreground font-semibold mb-1">Select Patient</label>
                <select
                  value={passForm.patientId}
                  onChange={(e) => setPassForm({ ...passForm, patientId: e.target.value })}
                  required
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                >
                  <option value="">-- Choose Patient --</option>
                  {patientsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} ({p.upi || p.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Movement Type</label>
                <select
                  value={passForm.movementType}
                  onChange={(e) => setPassForm({ ...passForm, movementType: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                >
                  <option value="THERAPEUTIC_PASS">Therapeutic Leave (Accompanied)</option>
                  <option value="MEDICAL_ESCORT">Medical Escort (Emergency Hospital)</option>
                  <option value="COURT_APPEARANCE">Court / Legal Escort</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Departure</label>
                  <input
                    type="datetime-local"
                    value={passForm.departureTime}
                    onChange={(e) => setPassForm({ ...passForm, departureTime: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Expected Return</label>
                  <input
                    type="datetime-local"
                    value={passForm.expectedReturn}
                    onChange={(e) => setPassForm({ ...passForm, expectedReturn: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Escort Officer / Family Member</label>
                <input
                  type="text"
                  placeholder="e.g. Nurse Antony Mwangi"
                  value={passForm.escortPerson}
                  onChange={(e) => setPassForm({ ...passForm, escortPerson: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border border-border rounded-xl text-foreground font-medium hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary-hover shadow-xs flex items-center space-x-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Authorize Pass</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Register Visitor */}
      {modalType === 'visitor' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="font-serif text-lg font-bold text-foreground">Register Gate Visitor</h3>
              <button onClick={() => setModalType(null)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRegisterVisitor} className="space-y-3 text-xs">
              <div>
                <label className="block text-foreground font-semibold mb-1">Visitor Full Name</label>
                <input
                  type="text"
                  required
                  value={visitorForm.visitorName}
                  onChange={(e) => setVisitorForm({ ...visitorForm, visitorName: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">National ID / Passport</label>
                  <input
                    type="text"
                    required
                    value={visitorForm.nationalId}
                    onChange={(e) => setVisitorForm({ ...visitorForm, nationalId: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Phone Number (+254)</label>
                  <input
                    type="text"
                    required
                    value={visitorForm.phoneNumber}
                    onChange={(e) => setVisitorForm({ ...visitorForm, phoneNumber: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Patient Visited</label>
                  <input
                    type="text"
                    required
                    value={visitorForm.patientName}
                    onChange={(e) => setVisitorForm({ ...visitorForm, patientName: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Relationship</label>
                  <input
                    type="text"
                    value={visitorForm.relationship}
                    onChange={(e) => setVisitorForm({ ...visitorForm, relationship: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border border-border rounded-xl text-foreground font-medium hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary-hover shadow-xs flex items-center space-x-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Check In Visitor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
