'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Share2,
  Plus,
  Search,
  Phone,
  Mail,
  Building2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Loader2,
  UserCheck,
} from 'lucide-react';

interface ReferralsViewProps {
  token: string | null;
  apiUrl: string;
}

export const ReferralsView: React.FC<ReferralsViewProps> = ({ token, apiUrl }) => {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    organizationName: '',
    contactPerson: '',
    phone: '',
    email: '',
    category: 'HOSPITAL',
    commissionNote: '',
  });

  const fetchPartners = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/referrals/partners`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPartners(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Referrals fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/referrals/partners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Referral partner organization enrolled.' });
        setIsModalOpen(false);
        setForm({
          organizationName: '',
          contactPerson: '',
          phone: '',
          email: '',
          category: 'HOSPITAL',
          commissionNote: '',
        });
        fetchPartners();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMsg({ type: 'error', text: err.message || 'Failed to enroll partner.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error enrolling partner.' });
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
              Referral Partners & Medical Network
            </h2>
            <p className="text-xs text-muted-foreground">
              Partner hospitals, corporate wellness programs, and community addiction practitioners
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Enroll Referral Partner</span>
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
                <th className="px-4 py-3">Organization & Partner</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Liaison Contact Person</th>
                <th className="px-4 py-3">Phone & Email</th>
                <th className="px-4 py-3">Active Pipeline Leads</th>
                <th className="px-4 py-3">Partnership Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && partners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-2" />
                    <span>Loading referral network directory...</span>
                  </td>
                </tr>
              ) : partners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                    <Building2 className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-semibold text-foreground">No referral partners registered yet</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Enrolled psychiatric clinics, hospitals, and corporate HR networks will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                partners.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-subtle transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{p.organizationName}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-soft text-primary">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{p.contactPerson}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-foreground">{p.phone}</div>
                      {p.email && <div className="text-[10px] text-muted-foreground">{p.email}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-foreground">
                      {p.leads?.length || 0} Leads Referred
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        MoU Active
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
              <h3 className="font-serif text-lg font-bold text-foreground">Enroll Referral Partner</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-foreground font-semibold mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ruiru Sub-County Level 4 Hospital"
                  value={form.organizationName}
                  onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  >
                    <option value="HOSPITAL">Level 4/5 Hospital</option>
                    <option value="CLINIC">Private Medical Clinic</option>
                    <option value="CORPORATE">Corporate HR / EAP</option>
                    <option value="COMMUNITY">Community / NGO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Contact Person</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Kamau"
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Phone (+254)</label>
                  <input
                    type="text"
                    required
                    placeholder="+2547XXXXXXXX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="partner@hospital.co.ke"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  />
                </div>
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
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary-hover shadow-xs flex items-center space-x-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enroll Partner</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
