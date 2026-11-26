'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  CalendarDays,
  Camera,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Pill,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';

interface PatientDashboardViewProps {
  token: string | null;
  apiUrl: string;
  patientId: string;
  onBack: () => void;
  onInvoiceCreated?: () => void;
  canCreateInvoice?: boolean;
  canDeletePatient?: boolean;
  /** Performs the confirmed delete in the parent and returns true when it succeeded. */
  onDelete?: (id: string, name: string) => Promise<boolean>;
}

type Tab = 'overview' | 'billing' | 'medication' | 'photos';

const pick = (source: any, ...keys: string[]): any => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== '') {
      return source[key];
    }
  }
  return null;
};

const money = (value: any) =>
  `KES ${Number(value || 0).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value: any) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const age = (dob: any) => {
  if (!dob) return '—';
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return Number.isFinite(years) && years > 0 ? `${years} yrs` : '—';
};

export const PatientDashboardView: React.FC<PatientDashboardViewProps> = ({
  token,
  apiUrl,
  patientId,
  onBack,
  onInvoiceCreated,
  canCreateInvoice = true,
  canDeletePatient = false,
  onDelete,
}) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [patient, setPatient] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    description: '',
    quantity: '1',
    unitPriceKES: '',
    smsPhone: '',
    whatsappNumber: '',
    dueDate: '',
    discount: '0',
    notes: '',
  });
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token || ''}` }), [token]);

  const request = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${apiUrl}${path}`, { headers, ...(init || {}) });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        message = body.message || message;
      } catch {
        /* non-JSON error */
      }
      throw new Error(message);
    }
    return res.json();
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [patientData, invoiceData, medicationData, photoData] = await Promise.allSettled([
        request(`/patients/${patientId}`),
        request(`/billing/invoices?patientId=${encodeURIComponent(patientId)}`),
        request(`/pharmacy/patient/${encodeURIComponent(patientId)}/medications`),
        request(`/patients/${patientId}/photos`),
      ]);
      if (patientData.status === 'fulfilled') setPatient(patientData.value);
      else setNotice({ type: 'error', text: `Patient details: ${patientData.reason?.message || 'unavailable'}` });
      setInvoices(invoiceData.status === 'fulfilled' && Array.isArray(invoiceData.value) ? invoiceData.value : []);
      setMedications(medicationData.status === 'fulfilled' && Array.isArray(medicationData.value) ? medicationData.value : []);
      setPhotos(photoData.status === 'fulfilled' && Array.isArray(photoData.value) ? photoData.value : []);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, apiUrl, patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const guardian = useMemo(() => {
    const contacts = Array.isArray(patient?.emergencyContacts) ? patient.emergencyContacts : [];
    return (
      contacts.find(
        (c: any) =>
          /guardian|parent/i.test(String(pick(c, 'relationship') || '')) ||
          /guardian|parent/i.test(String(pick(c, 'notes') || '')),
      ) || contacts[0]
    );
  }, [patient]);

  useEffect(() => {
    setInvoiceForm((current) => ({
      ...current,
      smsPhone:
        current.smsPhone ||
        String(pick(guardian, 'phone') || pick(patient, 'phone') || ''),
      whatsappNumber:
        current.whatsappNumber ||
        String(pick(guardian, 'alternativePhone') || pick(guardian, 'phone') || ''),
    }));
  }, [guardian, patient]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/image\/(jpeg|jpg|png)/i.test(file.type)) {
      setNotice({ type: 'error', text: 'Please choose a JPG or PNG photo.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice({ type: 'error', text: 'Photos must be 5 MB or smaller.' });
      return;
    }
    setUploading(true);
    setNotice(null);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read the selected photo.'));
        reader.readAsDataURL(file);
      });
      await request(`/patients/${patientId}/photos`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64 }),
      } as RequestInit);
      setNotice({ type: 'success', text: 'Photo saved to the patient record.' });
      await load();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Could not upload the photo.' });
    } finally {
      setUploading(false);
    }
  };

  const downloadPdf = async (invoice: any) => {
    const id = pick(invoice, 'id');
    if (!id) return;
    try {
      const res = await fetch(`${apiUrl}/billing/invoices/${id}/pdf`, { headers });
      if (!res.ok) throw new Error(`PDF download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Calyvia-${pick(invoice, 'invoiceNumber', 'invoice_number') || 'invoice'}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Could not download the invoice PDF.' });
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const displayName =
      [pick(patient, 'firstName', 'first_name'), pick(patient, 'lastName', 'last_name')]
        .filter(Boolean)
        .join(' ')
        .trim() || 'this patient';
    setDeleting(true);
    try {
      const deleted = await onDelete(patientId, displayName);
      if (deleted) onBack();
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    setInvoiceBusy(true);
    setNotice(null);
    try {
      const created = await request('/billing/invoices', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          billToName: name,
          billToPhone: invoiceForm.smsPhone.trim() || undefined,
          whatsappNumber: invoiceForm.whatsappNumber.trim() || undefined,
          items: [
            {
              description: invoiceForm.description.trim() || 'Treatment service',
              quantity: Number(invoiceForm.quantity) || 1,
              unitPriceKES: Number(invoiceForm.unitPriceKES) || 0,
            },
          ],
          dueDate: invoiceForm.dueDate || undefined,
          discount: Number(invoiceForm.discount) || 0,
          notes: invoiceForm.notes || undefined,
        }),
      } as RequestInit);
      setInvoiceOpen(false);
      setInvoiceForm({
        description: '',
        quantity: '1',
        unitPriceKES: '',
        smsPhone: '',
        whatsappNumber: '',
        dueDate: '',
        discount: '0',
        notes: '',
      });
      setNotice({
        type: 'success',
        text: `Invoice ${pick(created, 'invoiceNumber', 'invoice_number') || 'created'} added to the billing section.`,
      });
      await load();
      onInvoiceCreated?.();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Could not create the invoice.' });
    } finally {
      setInvoiceBusy(false);
    }
  };

  const name = [pick(patient, 'firstName', 'first_name'), pick(patient, 'lastName', 'last_name')]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Patient chart';
  const registration = pick(
    patient,
    'registrationNumber',
    'upi',
    'calyviaId',
    'registration_number',
  );
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part: string) => part[0])
    .join('')
    .toUpperCase();
  const avatar = photos.find((photo) => photo.url)?.url;

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'overview', label: 'Overview', icon: <UserRound className="w-3.5 h-3.5" /> },
    { id: 'billing', label: 'Billing', icon: <FileText className="w-3.5 h-3.5" />, count: invoices.length },
    { id: 'medication', label: 'Medication', icon: <Pill className="w-3.5 h-3.5" />, count: medications.length },
    { id: 'photos', label: 'Photos', icon: <Camera className="w-3.5 h-3.5" />, count: photos.length },
  ];

  const Detail = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) => (
    <div className="flex items-start gap-2.5">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="text-xs text-foreground font-medium break-words">{value || '—'}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {notice && (
        <div
          className={`p-3 rounded-xl text-xs border ${
            notice.type === 'error'
              ? 'bg-destructive-soft text-destructive border-destructive/30'
              : 'bg-success-soft text-success border-success/30'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl shadow-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-all"
              title="Back to patient registry"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt={name} className="w-16 h-16 rounded-2xl object-cover border border-border" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-primary-soft text-primary border border-primary/20 flex items-center justify-center font-serif text-xl font-bold">
                {initials || 'PT'}
              </div>
            )}
            <div>
              <h2 className="font-serif text-xl font-bold text-foreground">{name}</h2>
              <p className="text-[11px] font-mono text-muted-foreground">
                {registration || patientId}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-soft text-primary">
                  {pick(patient, 'status') || 'ENQUIRY'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-elevated text-muted-foreground">
                  {pick(patient, 'gender') || '—'} · {age(pick(patient, 'dateOfBirth', 'date_of_birth'))}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> {loading ? 'Loading…' : 'Refresh'}
            </button>
            {canDeletePatient && onDelete && (
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                title="Delete patient from the active registry"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-destructive/30 bg-destructive-soft text-destructive text-xs font-semibold hover:border-destructive/60 disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" /> {deleting ? 'Deleting…' : 'Delete patient'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              tab === item.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && (
              <span className="text-[10px] opacity-70">({item.count})</span>
            )}
          </button>
        ))}
      </div>

      {loading && !patient ? (
        <div className="bg-card border border-border rounded-2xl py-16 flex flex-col items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
          Loading patient dashboard…
        </div>
      ) : (
        <>
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-card border border-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-base font-bold text-foreground">Patient Details</h3>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Master Patient Index
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Detail icon={<Phone className="w-3.5 h-3.5" />} label="Phone (SMS)" value={pick(patient, 'phone')} />
                  <Detail icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={pick(patient, 'email')} />
                  <Detail icon={<CalendarDays className="w-3.5 h-3.5" />} label="Date of birth" value={formatDate(pick(patient, 'dateOfBirth', 'date_of_birth'))} />
                  <Detail icon={<MapPin className="w-3.5 h-3.5" />} label="County" value={pick(patient, 'county')} />
                  <Detail icon={<MapPin className="w-3.5 h-3.5" />} label="Address" value={pick(patient, 'residentialAddress', 'address')} />
                  <Detail icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Blood group" value={pick(patient, 'bloodGroup')} />
                </div>
                <div className="p-3 rounded-xl border border-border bg-surface-subtle space-y-2">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> Clinical flags
                  </div>
                  <p className="text-xs text-foreground">
                    <span className="text-muted-foreground">Allergies: </span>
                    {pick(patient, 'knownAllergies') || 'None recorded'}
                  </p>
                  <p className="text-xs text-foreground">
                    <span className="text-muted-foreground">Substance history: </span>
                    {pick(patient, 'substanceHistory') || 'None recorded'}
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-base font-bold text-foreground">Parent / Guardian</h3>
                  <UsersRound className="w-4 h-4 text-muted-foreground" />
                </div>
                {guardian ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-primary-soft border border-primary/20">
                      <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                        {String(pick(guardian, 'fullName') || 'G')[0]}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{pick(guardian, 'fullName')}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {pick(guardian, 'relationship') || 'GUARDIAN'}
                          {pick(guardian, 'isPrimaryGuarantor') ? ' · Primary guarantor' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Detail icon={<Phone className="w-3.5 h-3.5" />} label="Phone (SMS)" value={pick(guardian, 'phone')} />
                      <Detail icon={<MessageCircleIcon />} label="WhatsApp" value={pick(guardian, 'alternativePhone') || pick(guardian, 'phone')} />
                      <Detail icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={pick(guardian, 'email')} />
                      <Detail icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Contact consent" value={pick(guardian, 'consentToContact') ? 'Granted' : 'Not granted'} />
                    </div>
                    {pick(guardian, 'notes') && (
                      <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
                        {pick(guardian, 'notes')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-6 text-center">
                    No parent or guardian recorded for this patient.
                  </p>
                )}
              </div>

              {Array.isArray(patient?.admissions) && patient.admissions.length > 0 && (
                <div className="bg-card border border-border rounded-2xl shadow-card p-5 sm:p-6 lg:col-span-2">
                  <h3 className="font-serif text-base font-bold text-foreground mb-4">Admissions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {patient.admissions.map((admission: any, index: number) => (
                      <div key={pick(admission, 'id') || index} className="p-3 rounded-xl border border-border bg-surface-subtle text-xs">
                        <div className="font-semibold text-foreground">
                          {pick(admission, 'program', 'programType', 'admissionType') || 'Rehabilitation programme'}
                        </div>
                        <div className="text-muted-foreground mt-1">
                          {formatDate(pick(admission, 'admissionDate', 'admittedAt'))} · {pick(admission, 'status') || 'ACTIVE'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'billing' && (
            <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
              <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-base font-bold text-foreground">Invoices & Payments</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {invoices.length} invoice(s) linked to this patient
                  </p>
                </div>
                {canCreateInvoice && (
                  <button
                    onClick={() => setInvoiceOpen((open) => !open)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
                  >
                    {invoiceOpen ? <X className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                    {invoiceOpen ? 'Close form' : 'New invoice'}
                  </button>
                )}
              </div>

              {invoiceOpen && (
                <form onSubmit={handleCreateInvoice} className="p-5 border-b border-border bg-surface-subtle space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs">
                      <span className="block font-semibold text-foreground mb-1.5">Description</span>
                      <input
                        required
                        value={invoiceForm.description}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                        placeholder="e.g. 30-day rehabilitation programme"
                        className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="block font-semibold text-foreground mb-1.5">Bill to</span>
                      <input
                        readOnly
                        value={name}
                        className="w-full bg-surface-elevated border border-border rounded-xl p-2.5 text-xs text-muted-foreground"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="block font-semibold text-foreground mb-1.5">Quantity</span>
                      <input
                        type="number"
                        min="1"
                        value={invoiceForm.quantity}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, quantity: e.target.value })}
                        className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="block font-semibold text-foreground mb-1.5">Unit price (KES)</span>
                      <input
                        type="number"
                        min="0"
                        required
                        value={invoiceForm.unitPriceKES}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, unitPriceKES: e.target.value })}
                        placeholder="45000"
                        className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="block font-semibold text-foreground mb-1.5">SMS phone number</span>
                      <input
                        value={invoiceForm.smsPhone}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, smsPhone: e.target.value })}
                        placeholder="0712345678"
                        className="w-full bg-surface border border-border rounded-xl p-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="block font-semibold text-foreground mb-1.5">
                        WhatsApp number <span className="font-normal text-muted-foreground">(optional)</span>
                      </span>
                      <input
                        value={invoiceForm.whatsappNumber}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, whatsappNumber: e.target.value })}
                        placeholder="0723456789"
                        className="w-full bg-surface border border-border rounded-xl p-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="block font-semibold text-foreground mb-1.5">Due date</span>
                      <input
                        type="date"
                        value={invoiceForm.dueDate}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                        className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="block font-semibold text-foreground mb-1.5">Discount (KES)</span>
                      <input
                        type="number"
                        min="0"
                        value={invoiceForm.discount}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, discount: e.target.value })}
                        className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </label>
                  </div>
                  <label className="block text-xs">
                    <span className="block font-semibold text-foreground mb-1.5">Notes (optional)</span>
                    <input
                      value={invoiceForm.notes}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                      placeholder="Payment arrangement, programme details…"
                      className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </label>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={invoiceBusy}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
                    >
                      {invoiceBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      {invoiceBusy ? 'Creating…' : 'Create invoice'}
                    </button>
                  </div>
                </form>
              )}

              {invoices.length === 0 ? (
                <p className="p-10 text-center text-xs text-muted-foreground">No invoices for this patient yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Invoice</th>
                        <th className="px-4 py-3">Issued</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                        <th className="px-4 py-3 text-right">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {invoices.map((invoice, index) => (
                        <tr key={pick(invoice, 'id') || index} className="hover:bg-surface-subtle">
                          <td className="px-4 py-3 font-mono font-semibold text-foreground">
                            {pick(invoice, 'invoiceNumber', 'invoice_number') || '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(pick(invoice, 'issueDate', 'issue_date', 'createdAt'))}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-soft text-primary">
                              {pick(invoice, 'status') || 'ISSUED'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {money(pick(invoice, 'totalAmountKES', 'total_amount', 'totalAmount'))}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {money(pick(invoice, 'balanceKES', 'balance_due', 'balanceDue'))}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => downloadPdf(invoice)}
                              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                              title="Download invoice PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'medication' && (
            <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <h3 className="font-serif text-base font-bold text-foreground">Medication & Prescriptions</h3>
                <span className="text-[11px] text-muted-foreground">{medications.length} record(s)</span>
              </div>
              {medications.length === 0 ? (
                <p className="p-10 text-center text-xs text-muted-foreground">No prescriptions recorded for this patient.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Medication</th>
                        <th className="px-4 py-3">Dosage / Frequency</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Prescribed</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {medications.map((medication, index) => (
                        <tr key={pick(medication, 'prescriptionId') || index} className="hover:bg-surface-subtle">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">
                              {pick(medication, 'brandName') || 'Medication'}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {[pick(medication, 'genericName'), pick(medication, 'strength'), pick(medication, 'dosageForm')]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {pick(medication, 'dosage') || '—'} / {pick(medication, 'frequency') || '—'}
                            {pick(medication, 'route') ? ` · ${pick(medication, 'route')}` : ''}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {pick(medication, 'durationDays') ? `${pick(medication, 'durationDays')} days` : '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(pick(medication, 'prescribedDate'))}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-soft text-primary">
                              {pick(medication, 'status') || 'ACTIVE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'photos' && (
            <div className="bg-card border border-border rounded-2xl shadow-card p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-base font-bold text-foreground">Patient Photos</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Optional passport photos, stored privately in the patient-documents bucket. Signed links expire after 1 hour.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold cursor-pointer disabled:opacity-60">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? 'Uploading…' : 'Upload photo'}
                  <input type="file" accept="image/jpeg,image/png" onChange={handleUpload} className="hidden" />
                </label>
              </div>
              {photos.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  <ImageIcon className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
                  No photos uploaded yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.path} className="rounded-xl border border-border overflow-hidden bg-surface-subtle">
                      {photo.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo.url} alt={photo.name} className="w-full h-32 object-cover" />
                      ) : (
                        <div className="w-full h-32 flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div className="p-2">
                        <div className="text-[10px] font-medium text-foreground truncate" title={photo.name}>
                          {photo.name}
                        </div>
                        <div className="text-[9px] text-muted-foreground">{formatDate(photo.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

function MessageCircleIcon() {
  return <Phone className="w-3.5 h-3.5 rotate-90" />;
}
