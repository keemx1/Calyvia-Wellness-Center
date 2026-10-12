'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  X,
  Loader2,
  UserCheck,
  Calendar,
  Phone,
  AlertTriangle,
} from 'lucide-react';

interface DocumentsViewProps {
  token: string | null;
  apiUrl: string;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({ token, apiUrl }) => {
  const [activeTab, setActiveTab] = useState<'consents' | 'discharges' | 'aftercare'>('consents');
  const [consents, setConsents] = useState<any[]>([]);
  const [discharges, setDischarges] = useState<any[]>([]);
  const [aftercarePlans, setAftercarePlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [patientsList, setPatientsList] = useState<any[]>([]);

  // Modal states
  const [modalType, setModalType] = useState<'consent' | 'discharge' | 'checkin' | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Forms
  const [consentForm, setConsentForm] = useState({
    patientId: '',
    consentType: 'INPATIENT_REHAB_ADMISSION',
    signatoryName: '',
    signatoryPhone: '',
    signatureData: 'DIGITALLY_ACKNOWLEDGED_VIA_PORTAL',
  });

  const [dischargeForm, setDischargeForm] = useState({
    patientId: '',
    medicalSummary: '',
    familyBriefingNotes: '',
    signedByDoctor: 'Dr. Evelyn Wanjiku (Psychiatrist)',
    relapseRiskLevel: 'MODERATE',
  });

  const [checkinForm, setCheckinForm] = useState({
    aftercarePlanId: '',
    cadenceDay: 7,
    contactMethod: 'PHONE_CALL',
    sobrietyStatus: 'SOBER',
    notes: '',
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

  const fetchConsents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (patientsList.length > 0) {
        const promises = patientsList.slice(0, 10).map((p) =>
          fetch(`${apiUrl}/documents/patient/${p.id}/consents`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => (r.ok ? r.json() : [])),
        );
        const results = await Promise.all(promises);
        setConsents(results.flat());
      }
    } catch (err) {
      console.warn('Consents fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl, patientsList]);

  const fetchDischarges = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/discharge/records`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDischarges(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Discharge fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl]);

  const fetchAftercare = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/aftercare/plans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAftercarePlans(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Aftercare fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useEffect(() => {
    if (activeTab === 'consents') fetchConsents();
    if (activeTab === 'discharges') fetchDischarges();
    if (activeTab === 'aftercare') fetchAftercare();
  }, [activeTab, fetchConsents, fetchDischarges, fetchAftercare]);

  const handleCreateConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/documents/consents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(consentForm),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Digital consent form signed and recorded successfully.' });
        setModalType(null);
        fetchConsents();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMsg({ type: 'error', text: err.message || 'Failed to record consent.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error recording consent.' });
    } finally {
      setSaving(false);
    }
  };

  const handleProcessDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/discharge/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(dischargeForm),
      });
      if (res.ok) {
        setFeedbackMsg({
          type: 'success',
          text: 'Patient formally discharged and 90-day recovery cadence activated.',
        });
        setModalType(null);
        fetchDischarges();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMsg({ type: 'error', text: err.message || 'Failed to process discharge.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error processing discharge.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRecordCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/aftercare/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(checkinForm),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Recovery cadence milestone check-in logged.' });
        setModalType(null);
        fetchAftercare();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMsg({ type: 'error', text: err.message || 'Failed to log checkin.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error logging checkin.' });
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
              Documents, Discharge & Aftercare
            </h2>
            <p className="text-xs text-muted-foreground">
              KDPA digital consents, multidisciplinary discharge summaries, and 90-day relapse prevention
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {activeTab === 'consents' && (
              <button
                onClick={() => {
                  setConsentForm({
                    patientId: patientsList[0]?.id || '',
                    consentType: 'INPATIENT_REHAB_ADMISSION',
                    signatoryName: '',
                    signatoryPhone: '',
                    signatureData: 'DIGITALLY_ACKNOWLEDGED_VIA_PORTAL',
                  });
                  setModalType('consent');
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>New Digital Consent</span>
              </button>
            )}
            {activeTab === 'discharges' && (
              <button
                onClick={() => {
                  setDischargeForm({
                    patientId: patientsList[0]?.id || '',
                    medicalSummary: '',
                    familyBriefingNotes: '',
                    signedByDoctor: 'Dr. Evelyn Wanjiku (Psychiatrist)',
                    relapseRiskLevel: 'MODERATE',
                  });
                  setModalType('discharge');
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Process Discharge</span>
              </button>
            )}
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

        {/* Tab Navigation */}
        <div className="flex border-b border-border space-x-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('consents')}
            className={`pb-2.5 transition border-b-2 ${
              activeTab === 'consents'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Digital Forms & Consents
          </button>
          <button
            onClick={() => setActiveTab('discharges')}
            className={`pb-2.5 transition border-b-2 ${
              activeTab === 'discharges'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Discharge Summaries & Clearances
          </button>
          <button
            onClick={() => setActiveTab('aftercare')}
            className={`pb-2.5 transition border-b-2 ${
              activeTab === 'aftercare'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            90-Day Aftercare & Recovery Plans
          </button>
        </div>

        {/* Tab 1: Consents */}
        {activeTab === 'consents' && (
          <div className="overflow-x-auto rounded-xl border border-border mt-3">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3">Consent Agreement</th>
                  <th className="px-4 py-3">Signatory</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Signed Date</th>
                  <th className="px-4 py-3">Compliance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {consents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                      <FileText className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="font-semibold text-foreground">No digital consents signed yet</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Patient admission agreements, medical release, and KDPA consent forms will appear here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  consents.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-subtle transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">{c.consentType}</td>
                      <td className="px-4 py-3 text-foreground">{c.signatoryName}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{c.signatoryPhone || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.signedAt ? new Date(c.signedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Legally Executed
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Discharges */}
        {activeTab === 'discharges' && (
          <div className="overflow-x-auto rounded-xl border border-border mt-3">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Discharging Physician</th>
                  <th className="px-4 py-3">Medical Summary</th>
                  <th className="px-4 py-3">Clearances</th>
                  <th className="px-4 py-3">Discharge Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {discharges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                      <UserCheck className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="font-semibold text-foreground">No patient discharge records recorded yet</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Formal psychiatric and financial clearances will populate here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  discharges.map((d) => (
                    <tr key={d.id} className="hover:bg-surface-subtle transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {d.patient ? `${d.patient.firstName} ${d.patient.lastName}` : d.patientId}
                      </td>
                      <td className="px-4 py-3 text-foreground">{d.signedByDoctor}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{d.medicalSummary}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-soft text-success">
                          Clinical & Finance Cleared
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {d.dischargeDate ? new Date(d.dischargeDate).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Aftercare Plans */}
        {activeTab === 'aftercare' && (
          <div className="overflow-x-auto rounded-xl border border-border mt-3">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3">Patient / CAL-ID</th>
                  <th className="px-4 py-3">Counsellor in Charge</th>
                  <th className="px-4 py-3">Relapse Risk</th>
                  <th className="px-4 py-3">Support Group</th>
                  <th className="px-4 py-3">Check-ins Logged</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {aftercarePlans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                      <ShieldCheck className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="font-semibold text-foreground">No active 90-day aftercare plans</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Plans are automatically generated upon patient discharge to monitor long-term recovery.
                      </p>
                    </td>
                  </tr>
                ) : (
                  aftercarePlans.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-subtle transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : p.patientId}
                      </td>
                      <td className="px-4 py-3 text-foreground">{p.counsellorInCharge}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning-soft text-warning">
                          {p.relapseRiskLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.supportGroupDetails}</td>
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        {p.checkins?.length || 0} / 5 Cadence Check-ins
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setCheckinForm({
                              aftercarePlanId: p.id,
                              cadenceDay: 7,
                              contactMethod: 'PHONE_CALL',
                              sobrietyStatus: 'SOBER',
                              notes: '',
                            });
                            setModalType('checkin');
                          }}
                          className="px-2.5 py-1 bg-primary text-primary-foreground text-[11px] font-semibold rounded-lg hover:bg-primary-hover shadow-xs"
                        >
                          Log Check-in
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: New Consent */}
      {modalType === 'consent' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="font-serif text-lg font-bold text-foreground">Record Digital Patient Consent</h3>
              <button onClick={() => setModalType(null)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateConsent} className="space-y-3 text-xs">
              <div>
                <label className="block text-foreground font-semibold mb-1">Select Patient</label>
                <select
                  value={consentForm.patientId}
                  onChange={(e) => setConsentForm({ ...consentForm, patientId: e.target.value })}
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
                <label className="block text-foreground font-semibold mb-1">Agreement Type</label>
                <select
                  value={consentForm.consentType}
                  onChange={(e) => setConsentForm({ ...consentForm, consentType: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                >
                  <option value="INPATIENT_REHAB_ADMISSION">Inpatient Rehab Admission Agreement</option>
                  <option value="MEDICAL_DETOX_PROTOCOL">Medical Detox & Pharmacotherapy Consent</option>
                  <option value="KDPA_DATA_PROCESSING">KDPA 2019 Health Data Processing Consent</option>
                  <option value="FAMILY_REPRESENTATIVE_AUTH">Family Representative Authorization</option>
                </select>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Signatory Legal Name</label>
                <input
                  type="text"
                  required
                  value={consentForm.signatoryName}
                  onChange={(e) => setConsentForm({ ...consentForm, signatoryName: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Signatory Phone (+254)</label>
                <input
                  type="text"
                  value={consentForm.signatoryPhone}
                  onChange={(e) => setConsentForm({ ...consentForm, signatoryPhone: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none"
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
                  <span>Sign Agreement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Process Discharge */}
      {modalType === 'discharge' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="font-serif text-lg font-bold text-foreground">Process Formal Inpatient Discharge</h3>
              <button onClick={() => setModalType(null)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleProcessDischarge} className="space-y-3 text-xs">
              <div>
                <label className="block text-foreground font-semibold mb-1">Select Patient</label>
                <select
                  value={dischargeForm.patientId}
                  onChange={(e) => setDischargeForm({ ...dischargeForm, patientId: e.target.value })}
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
                <label className="block text-foreground font-semibold mb-1">Discharging Physician</label>
                <input
                  type="text"
                  required
                  value={dischargeForm.signedByDoctor}
                  onChange={(e) => setDischargeForm({ ...dischargeForm, signedByDoctor: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Relapse Risk Assessment</label>
                <select
                  value={dischargeForm.relapseRiskLevel}
                  onChange={(e) => setDischargeForm({ ...dischargeForm, relapseRiskLevel: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                >
                  <option value="LOW">Low Risk</option>
                  <option value="MODERATE">Moderate Risk</option>
                  <option value="HIGH">High Risk</option>
                </select>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Clinical Discharge Summary</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Detox outcome, psychiatric stabilization summary, medications upon discharge..."
                  value={dischargeForm.medicalSummary}
                  onChange={(e) => setDischargeForm({ ...dischargeForm, medicalSummary: e.target.value })}
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
                  <span>Authorize Discharge</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Checkin */}
      {modalType === 'checkin' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="font-serif text-lg font-bold text-foreground">Log 90-Day Cadence Check-in</h3>
              <button onClick={() => setModalType(null)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecordCheckin} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Cadence Day</label>
                  <select
                    value={checkinForm.cadenceDay}
                    onChange={(e) => setCheckinForm({ ...checkinForm, cadenceDay: Number(e.target.value) })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  >
                    <option value={7}>Day 7 Follow-up</option>
                    <option value={14}>Day 14 Follow-up</option>
                    <option value={30}>Day 30 Milestone</option>
                    <option value={60}>Day 60 Review</option>
                    <option value={90}>Day 90 Sobriety Survey</option>
                  </select>
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Contact Method</label>
                  <select
                    value={checkinForm.contactMethod}
                    onChange={(e) => setCheckinForm({ ...checkinForm, contactMethod: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  >
                    <option value="PHONE_CALL">Phone Call</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="IN_PERSON">In-Person Fellowship</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Sobriety Status</label>
                <select
                  value={checkinForm.sobrietyStatus}
                  onChange={(e) => setCheckinForm({ ...checkinForm, sobrietyStatus: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                >
                  <option value="SOBER">Sober & Stable</option>
                  <option value="STRUGGLING">Experiencing Cravings / Struggling</option>
                  <option value="RELAPSED">Relapse Reported (Escalate to MDT)</option>
                </select>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Check-in Observations</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Patient mental state, support group attendance, trigger management..."
                  value={checkinForm.notes}
                  onChange={(e) => setCheckinForm({ ...checkinForm, notes: e.target.value })}
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
                  <span>Save Check-in</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
