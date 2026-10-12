'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Trash2,
  Edit2,
  UserCheck,
} from 'lucide-react';

interface FamilyManagementViewProps {
  token: string | null;
  apiUrl: string;
}

export const FamilyManagementView: React.FC<FamilyManagementViewProps> = ({ token, apiUrl }) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [relFilter, setRelFilter] = useState('ALL');
  const [guarantorFilter, setGuarantorFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Available patients for linking
  const [patientsList, setPatientsList] = useState<any[]>([]);

  const [form, setForm] = useState({
    patientId: '',
    fullName: '',
    relationship: 'SPOUSE',
    phone: '',
    email: '',
    isPrimaryGuarantor: false,
    consentToContact: true,
    notes: '',
  });

  const fetchContacts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.append('search', search);

      const res = await fetch(`${apiUrl}/family/contacts?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Failed to fetch family contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl, search]);

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
      console.warn('Failed to fetch patients list:', err);
    }
  }, [token, apiUrl]);

  useEffect(() => {
    fetchContacts();
    fetchPatients();
  }, [fetchContacts, fetchPatients]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      patientId: patientsList[0]?.id || '',
      fullName: '',
      relationship: 'SPOUSE',
      phone: '',
      email: '',
      isPrimaryGuarantor: false,
      consentToContact: true,
      notes: '',
    });
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (contact: any) => {
    setEditingId(contact.id);
    setForm({
      patientId: contact.patientId || '',
      fullName: contact.fullName || contact.name || '',
      relationship: contact.relationship || 'SPOUSE',
      phone: contact.phone || '',
      email: contact.email || '',
      isPrimaryGuarantor: Boolean(contact.isPrimaryGuarantor),
      consentToContact: contact.consentToContact !== false,
      notes: contact.notes || '',
    });
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const url = editingId ? `${apiUrl}/family/contacts/${editingId}` : `${apiUrl}/family/contacts`;
      const method = editingId ? 'PATCH' : 'POST';

      const payload: any = {
        fullName: form.fullName,
        relationship: form.relationship,
        phone: form.phone,
        email: form.email || undefined,
        isPrimaryGuarantor: form.isPrimaryGuarantor,
        consentToContact: form.consentToContact,
        notes: form.notes || undefined,
      };

      if (!editingId && form.patientId) {
        payload.patientId = form.patientId;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccessMsg(
          editingId ? 'Family contact updated successfully.' : 'Family contact registered successfully.',
        );
        setIsModalOpen(false);
        fetchContacts();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.message || 'Failed to save family contact.');
      }
    } catch {
      setErrorMsg('Network error connecting to family management service.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove family contact "${name}"?`)) return;
    if (!token) return;

    setDeletingId(id);
    try {
      const res = await fetch(`${apiUrl}/family/contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSuccessMsg('Family contact deleted successfully.');
        fetchContacts();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to delete contact.');
      }
    } catch {
      alert('Network error attempting to delete contact.');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = contacts.filter((c) => {
    const term = search.toLowerCase();
    const contactName = (c.fullName || c.name || '').toLowerCase();
    const patientName = `${c.patient?.firstName || ''} ${c.patient?.lastName || ''}`.toLowerCase();
    const upi = (c.patient?.upi || c.patient?.registrationNumber || '').toLowerCase();
    const phone = (c.phone || '').toLowerCase();

    const matchesSearch =
      contactName.includes(term) || patientName.includes(term) || upi.includes(term) || phone.includes(term);

    const matchesRel = relFilter === 'ALL' || c.relationship === relFilter;
    const matchesGuarantor =
      guarantorFilter === 'ALL' ||
      (guarantorFilter === 'GUARANTOR' && c.isPrimaryGuarantor) ||
      (guarantorFilter === 'NON_GUARANTOR' && !c.isPrimaryGuarantor);

    return matchesSearch && matchesRel && matchesGuarantor;
  });

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-foreground">
              Family Management & Emergency Contacts
            </h2>
            <p className="text-xs text-muted-foreground">
              Next-of-kin registry, financial guarantors, and KDPA consent verification
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Register Family Contact</span>
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
              placeholder="Search by contact name, patient name, CAL-ID, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-subtle border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <select
            value={relFilter}
            onChange={(e) => setRelFilter(e.target.value)}
            className="bg-surface-subtle border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
          >
            <option value="ALL">All Relationships</option>
            <option value="SPOUSE">Spouse</option>
            <option value="PARENT">Parent / Guardian</option>
            <option value="SIBLING">Sibling</option>
            <option value="CHILD">Adult Child</option>
            <option value="OTHER">Other Kin</option>
          </select>
          <select
            value={guarantorFilter}
            onChange={(e) => setGuarantorFilter(e.target.value)}
            className="bg-surface-subtle border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
          >
            <option value="ALL">All Financial Roles</option>
            <option value="GUARANTOR">Primary Guarantor</option>
            <option value="NON_GUARANTOR">Contact Only</option>
          </select>
        </div>

        {/* Contacts Table */}
        <div className="overflow-x-auto rounded-xl border border-border mt-3">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="px-4 py-3">Contact Name</th>
                <th className="px-4 py-3">Relationship</th>
                <th className="px-4 py-3">Associated Patient</th>
                <th className="px-4 py-3">Phone & Email</th>
                <th className="px-4 py-3">Guarantor Status</th>
                <th className="px-4 py-3">KDPA Consent</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && contacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-2" />
                    <span>Loading family contacts...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    <Users className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-semibold text-foreground">
                      {search || relFilter !== 'ALL' || guarantorFilter !== 'ALL'
                        ? 'No family contacts match your filter criteria'
                        : 'No family contacts registered yet'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {search || relFilter !== 'ALL' || guarantorFilter !== 'ALL'
                        ? 'Try clearing or modifying your search terms.'
                        : 'Click "Register Family Contact" above to link a next-of-kin or financial guarantor.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-subtle transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{c.fullName || c.name}</div>
                      {c.notes && <div className="text-[10px] text-muted-foreground truncate max-w-xs">{c.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary-soft text-secondary">
                        {c.relationship}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.patient ? (
                        <div>
                          <div className="font-semibold text-foreground">
                            {c.patient.firstName} {c.patient.lastName}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {c.patient.upi || c.patient.registrationNumber || c.patient.id}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-mono">{c.patientId || 'Unlinked'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-foreground">{c.phone}</div>
                      {c.email && <div className="text-[11px] text-muted-foreground">{c.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {c.isPrimaryGuarantor ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Primary Guarantor
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface border border-border text-muted-foreground">
                          Emergency Kin
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.consentToContact !== false ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-soft text-primary">
                          Consent Granted
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-danger-soft text-danger">
                          No Consent
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 rounded-lg border border-border text-foreground hover:bg-surface-elevated transition"
                          title="Edit Contact"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.fullName || c.name)}
                          disabled={deletingId === c.id}
                          className="p-1.5 rounded-lg border border-border text-danger hover:bg-danger-soft transition disabled:opacity-50"
                          title="Delete Contact"
                        >
                          {deletingId === c.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add / Edit Family Contact */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="font-serif text-lg font-bold text-foreground">
                {editingId ? 'Edit Family Contact' : 'Register Family Contact'}
              </h3>
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
              {!editingId && (
                <div>
                  <label className="block text-foreground font-semibold mb-1">Select Patient</label>
                  <select
                    value={form.patientId}
                    onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                    required
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Choose Patient --</option>
                    {patientsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} ({p.upi || p.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-foreground font-semibold mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mary Muthoni Karanja"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Relationship</label>
                  <select
                    value={form.relationship}
                    onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="SPOUSE">Spouse</option>
                    <option value="PARENT">Parent</option>
                    <option value="SIBLING">Sibling</option>
                    <option value="CHILD">Adult Child</option>
                    <option value="GUARDIAN">Legal Guardian</option>
                    <option value="FRIEND">Next of Kin / Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Phone (+254)</label>
                  <input
                    type="text"
                    required
                    placeholder="+2547XXXXXXXX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="contact@example.co.ke"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Guarantor agreements, visitation clearance, emergency escalation notes..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center space-x-2 text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPrimaryGuarantor}
                    onChange={(e) => setForm({ ...form, isPrimaryGuarantor: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Designate as Primary Financial Guarantor</span>
                </label>

                <label className="flex items-center space-x-2 text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.consentToContact}
                    onChange={(e) => setForm({ ...form, consentToContact: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Consent to Contact under KDPA 2019 granted</span>
                </label>
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
                  <span>{editingId ? 'Update Contact' : 'Register Contact'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
