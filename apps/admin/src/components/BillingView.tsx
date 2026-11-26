'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Receipt,
  RefreshCw,
  Send,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';

interface BillingViewProps {
  token: string | null;
  apiUrl: string;
  /** Incremented by other views (e.g. patient dashboard) after creating an invoice. */
  refreshKey?: number;
}

type Tab = 'invoices' | 'create' | 'payments';
type LineItem = { description: string; quantity: string; unitPriceKES: string };

const emptyItem = (): LineItem => ({ description: '', quantity: '1', unitPriceKES: '' });

const pick = (row: any, ...keys: string[]) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
};

const money = (value: any) =>
  `KES ${Number(value ?? 0).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const shortDate = (value: any) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusTone = (status: string) => {
  const value = String(status || '').toUpperCase();
  if (value === 'FULLY_PAID' || value === 'PAID') return 'bg-success-soft text-success';
  if (value === 'PARTIALLY_PAID') return 'bg-warning-soft text-warning';
  if (value === 'VOID' || value === 'CANCELLED') return 'bg-destructive-soft text-destructive';
  return 'bg-info-soft text-info';
};

async function errorMessage(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  return body?.message || fallback;
}

export const BillingView: React.FC<BillingViewProps> = ({ token, apiUrl, refreshKey = 0 }) => {
  const [tab, setTab] = useState<Tab>('invoices');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    billToName: '',
    billToPhone: '',
    patientId: '',
    admissionId: '',
    dueDate: '',
    discount: '0',
    notes: '',
  });
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);

  const [paymentForm, setPaymentForm] = useState({
    invoiceId: '',
    amountKES: '',
    paymentMethod: 'CASH',
    transactionRef: '',
    receivedBy: '',
  });

  const [sendModal, setSendModal] = useState<{ invoice: any; recipient: string } | null>(null);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token || ''}` }),
    [token],
  );

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [invoiceRes, paymentRes] = await Promise.all([
        fetch(`${apiUrl}/billing/invoices`, { headers: authHeaders }),
        fetch(`${apiUrl}/billing/payments`, { headers: authHeaders }),
      ]);
      if (invoiceRes.ok) setInvoices(await invoiceRes.json());
      if (paymentRes.ok) setPayments(await paymentRes.json());
      if (!invoiceRes.ok) {
        setNotice({
          type: 'error',
          text: await errorMessage(invoiceRes, 'Could not load invoices.'),
        });
      }
    } catch {
      setNotice({ type: 'error', text: 'Network error loading the invoicing center.' });
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authHeaders, token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, refreshKey]);

  const totals = useMemo(() => {
    const total = invoices.reduce(
      (sum, invoice) => sum + Number(pick(invoice, 'totalAmountKES', 'total_amount') ?? 0),
      0,
    );
    const outstanding = invoices.reduce(
      (sum, invoice) => sum + Number(pick(invoice, 'balanceKES', 'balance_due') ?? 0),
      0,
    );
    return { total, outstanding, collected: Math.max(0, total - outstanding) };
  }, [invoices]);

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const handleCreateInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanItems = items
      .filter((item) => item.description.trim() && Number(item.unitPriceKES) > 0)
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 1,
        unitPriceKES: Number(item.unitPriceKES),
      }));
    if (!cleanItems.length) {
      setNotice({ type: 'error', text: 'Add at least one item with a description and price.' });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`${apiUrl}/billing/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          ...form,
          discount: Number(form.discount) || 0,
          patientId: form.patientId || undefined,
          admissionId: form.admissionId || undefined,
          dueDate: form.dueDate || undefined,
          billToName: form.billToName || undefined,
          billToPhone: form.billToPhone || undefined,
          items: cleanItems,
        }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not create invoice.'));
      setNotice({ type: 'success', text: 'Invoice created and ready to download or send.' });
      setForm({
        billToName: '',
        billToPhone: '',
        patientId: '',
        admissionId: '',
        dueDate: '',
        discount: '0',
        notes: '',
      });
      setItems([emptyItem()]);
      await fetchAll();
      setTab('invoices');
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Could not create invoice.' });
    } finally {
      setBusy(false);
    }
  };

  const handleAutoGenerate = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`${apiUrl}/billing/invoices/auto`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Automatic invoicing failed.'));
      const data = await res.json();
      setNotice({
        type: 'success',
        text: `Generated ${data.generated ?? 0} invoice(s), skipped ${data.skipped ?? 0} already billed today. Total ${money(data.totalKES ?? 0)}.`,
      });
      await fetchAll();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Automatic invoicing failed.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (invoice: any) => {
    setBusy(true);
    setNotice(null);
    try {
      const id = pick(invoice, 'id');
      const res = await fetch(`${apiUrl}/billing/invoices/${id}/pdf`, { headers: authHeaders });
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not generate the PDF.'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const suggested = res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1];
      link.href = url;
      link.download = suggested || `Calyvia-${pick(invoice, 'invoiceNumber', 'invoice_number') || 'invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice({ type: 'success', text: 'Invoice PDF downloaded.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Could not download the PDF.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteInvoice = async (invoice: any) => {
    const number = pick(invoice, 'invoiceNumber', 'invoice_number');
    if (!window.confirm(`Delete invoice ${number}? Its line items and payments will also be removed.`)) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`${apiUrl}/billing/invoices/${pick(invoice, 'id')}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not delete the invoice.'));
      setNotice({ type: 'success', text: `Invoice ${number} deleted.` });
      await fetchAll();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Could not delete the invoice.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!sendModal) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(
        `${apiUrl}/billing/invoices/${pick(sendModal.invoice, 'id')}/send-whatsapp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ recipient: sendModal.recipient }),
        },
      );
      if (!res.ok) throw new Error(await errorMessage(res, 'WhatsApp delivery failed.'));
      setNotice({
        type: 'success',
        text: `Invoice PDF delivered via WhatsApp to ${sendModal.recipient}.`,
      });
      setSendModal(null);
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'WhatsApp delivery failed.' });
    } finally {
      setBusy(false);
    }
  };

  const handleRecordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentForm.invoiceId || !Number(paymentForm.amountKES)) {
      setNotice({ type: 'error', text: 'Choose an invoice and enter a payment amount.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`${apiUrl}/billing/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          ...paymentForm,
          amountKES: Number(paymentForm.amountKES),
        }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not record the payment.'));
      setNotice({ type: 'success', text: 'Payment recorded and invoice balance updated.' });
      setPaymentForm({
        invoiceId: '',
        amountKES: '',
        paymentMethod: 'CASH',
        transactionRef: '',
        receivedBy: '',
      });
      await fetchAll();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Could not record the payment.' });
    } finally {
      setBusy(false);
    }
  };

  const tabButton = (id: Tab, label: string, Icon: React.ComponentType<{ className?: string }>) => (
    <button
      type="button"
      onClick={() => { setTab(id); setNotice(null); }}
      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
        tab === id
          ? 'bg-primary text-primary-foreground shadow-xs'
          : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="bg-card p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-foreground">Invoicing Center</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Generate invoices manually or from active admissions, download letterhead PDFs, and
            deliver them straight to the client on WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabButton('invoices', 'Invoices', FileText)}
          {tabButton('create', 'New invoice', Plus)}
          {tabButton('payments', 'Payments', CreditCard)}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total invoiced', value: money(totals.total), Icon: Receipt },
          { label: 'Collected', value: money(totals.collected), Icon: CheckCircle2 },
          { label: 'Outstanding', value: money(totals.outstanding), Icon: AlertCircle },
        ].map(({ label, value, Icon }) => (
          <div
            key={label}
            className="bg-surface-subtle border border-border rounded-2xl p-4 flex items-start gap-3"
          >
            <Icon className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2 text-xs p-3 rounded-xl border ${
            notice.type === 'success'
              ? 'bg-success-soft text-success border-success/30'
              : 'bg-destructive-soft text-destructive border-destructive/30'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="ml-auto">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {tab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {loading ? 'Loading invoices…' : `${invoices.length} invoice(s)`} · PDFs use the
              official Calyvia letterhead.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={fetchAll}
                disabled={loading || busy}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-all disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleAutoGenerate}
                disabled={busy}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover transition-all disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                Auto-generate from admissions
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-border rounded-2xl">
            <table className="w-full text-left text-xs min-w-[860px]">
              <thead className="bg-surface-subtle text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Invoice</th>
                  <th className="px-4 py-3 font-semibold">Bill to</th>
                  <th className="px-4 py-3 font-semibold">Issued</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                  <th className="px-4 py-3 font-semibold text-right">Balance</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((invoice) => (
                  <tr key={pick(invoice, 'id')} className="hover:bg-surface-subtle/60">
                    <td className="px-4 py-3">
                      <p className="font-bold text-foreground">
                        {pick(invoice, 'invoiceNumber', 'invoice_number') || '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {pick(invoice, 'source') === 'AUTO' ? 'Auto-generated' : 'Manual'} · due{' '}
                        {shortDate(pick(invoice, 'dueDate', 'due_date'))}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">
                        {pick(invoice, 'billToName') || 'Patient account'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {pick(invoice, 'billToPhone') || 'No phone on file'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {shortDate(pick(invoice, 'issueDate', 'issue_date', 'createdAt'))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded-lg text-[10px] font-bold ${statusTone(
                          String(pick(invoice, 'status') ?? ''),
                        )}`}
                      >
                        {String(pick(invoice, 'status') ?? 'ISSUED').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {money(pick(invoice, 'totalAmountKES', 'total_amount'))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-warning">
                      {money(pick(invoice, 'balanceKES', 'balance_due'))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          title="Download PDF"
                          onClick={() => handleDownload(invoice)}
                          disabled={busy}
                          className="p-2 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-all disabled:opacity-60"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Send on WhatsApp"
                          onClick={() =>
                            setSendModal({
                              invoice,
                              recipient: String(pick(invoice, 'billToPhone') ?? ''),
                            })
                          }
                          disabled={busy}
                          className="p-2 rounded-lg border border-border text-muted-foreground hover:text-success hover:border-success/40 transition-all disabled:opacity-60"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete invoice"
                          onClick={() => handleDeleteInvoice(invoice)}
                          disabled={busy}
                          className="p-2 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-all disabled:opacity-60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!invoices.length && !loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No invoices yet. Create one manually or auto-generate from admissions.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'create' && (
        <form onSubmit={handleCreateInvoice} className="space-y-5 max-w-4xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-xs">
              <span className="block font-semibold text-foreground mb-1.5">Bill to (name)</span>
              <input
                value={form.billToName}
                onChange={(e) => setForm({ ...form, billToName: e.target.value })}
                placeholder="Walk-in client or patient name"
                className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block text-xs">
              <span className="block font-semibold text-foreground mb-1.5">Phone (WhatsApp/SMS)</span>
              <input
                value={form.billToPhone}
                onChange={(e) => setForm({ ...form, billToPhone: e.target.value })}
                placeholder="0712345678"
                className="w-full bg-surface border border-border rounded-xl p-2.5 font-mono text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block text-xs">
              <span className="block font-semibold text-foreground mb-1.5">
                Patient ID <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input
                value={form.patientId}
                onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                placeholder="UUID of registered patient"
                className="w-full bg-surface border border-border rounded-xl p-2.5 font-mono text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block text-xs">
              <span className="block font-semibold text-foreground mb-1.5">
                Admission ID <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input
                value={form.admissionId}
                onChange={(e) => setForm({ ...form, admissionId: e.target.value })}
                placeholder="UUID of active admission"
                className="w-full bg-surface border border-border rounded-xl p-2.5 font-mono text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block text-xs">
              <span className="block font-semibold text-foreground mb-1.5">Due date</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block text-xs">
              <span className="block font-semibold text-foreground mb-1.5">Discount (KES)</span>
              <input
                type="number"
                min="0"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
                className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_90px_140px_40px] gap-2 bg-surface-subtle px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Description</span>
              <span>Qty</span>
              <span>Unit price (KES)</span>
              <span />
            </div>
            <div className="divide-y divide-border">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_90px_140px_40px] gap-2 p-3">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder="e.g. Detox consultation"
                    className="bg-surface border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: e.target.value })}
                    className="bg-surface border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                  <input
                    type="number"
                    min="0"
                    value={item.unitPriceKES}
                    onChange={(e) => updateItem(index, { unitPriceKES: e.target.value })}
                    className="bg-surface border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    title="Remove item"
                    onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                    disabled={items.length === 1}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive-soft transition-all disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-4 py-3">
              <button
                type="button"
                onClick={() => setItems((current) => [...current, emptyItem()])}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add line item
              </button>
            </div>
          </div>

          <label className="block text-xs">
            <span className="block font-semibold text-foreground mb-1.5">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Payment terms, treatment episode, etc."
              className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
            />
          </label>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-bold text-foreground">
              Total:{' '}
              {money(
                items.reduce(
                  (sum, item) =>
                    sum + (Number(item.quantity) || 0) * (Number(item.unitPriceKES) || 0),
                  0,
                ) - (Number(form.discount) || 0),
              )}
            </p>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary-hover transition-all disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Create invoice
            </button>
          </div>
        </form>
      )}

      {tab === 'payments' && (
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
          <form
            onSubmit={handleRecordPayment}
            className="bg-surface-subtle border border-border rounded-2xl p-5 space-y-3.5 text-xs"
          >
            <h3 className="font-serif text-base font-bold text-foreground">Record a payment</h3>
            <label className="block">
              <span className="block font-semibold text-foreground mb-1.5">Invoice</span>
              <select
                value={paymentForm.invoiceId}
                onChange={(e) => setPaymentForm({ ...paymentForm, invoiceId: e.target.value })}
                className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Select invoice</option>
                {invoices.map((invoice) => (
                  <option key={pick(invoice, 'id')} value={pick(invoice, 'id')}>
                    {pick(invoice, 'invoiceNumber', 'invoice_number')} ·{' '}
                    {money(pick(invoice, 'balanceKES', 'balance_due'))} due
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block font-semibold text-foreground mb-1.5">Amount (KES)</span>
              <input
                type="number"
                min="1"
                value={paymentForm.amountKES}
                onChange={(e) => setPaymentForm({ ...paymentForm, amountKES: e.target.value })}
                className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="block font-semibold text-foreground mb-1.5">Method</span>
              <select
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                {['CASH', 'BANK_TRANSFER', 'MPESA_C2B', 'MPESA_STK', 'INSURANCE_COPAY'].map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block font-semibold text-foreground mb-1.5">
                Transaction reference
              </span>
              <input
                value={paymentForm.transactionRef}
                onChange={(e) => setPaymentForm({ ...paymentForm, transactionRef: e.target.value })}
                className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="block font-semibold text-foreground mb-1.5">Received by</span>
              <input
                value={paymentForm.receivedBy}
                onChange={(e) => setPaymentForm({ ...paymentForm, receivedBy: e.target.value })}
                placeholder="Finance desk / staff name"
                className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary-hover transition-all disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              Record payment
            </button>
          </form>

          <div className="overflow-x-auto border border-border rounded-2xl">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead className="bg-surface-subtle text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Receipt</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((payment) => (
                  <tr key={pick(payment, 'id')} className="hover:bg-surface-subtle/60">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {pick(payment, 'receiptNumber', 'receipt_number') || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {shortDate(pick(payment, 'paymentDate', 'payment_date', 'createdAt'))}
                    </td>
                    <td className="px-4 py-3">
                      {String(pick(payment, 'paymentMethod', 'payment_method') ?? '').replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {pick(payment, 'transactionRef', 'payment_reference') || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-success">
                      {money(pick(payment, 'amountKES', 'amount_paid'))}
                    </td>
                  </tr>
                ))}
                {!payments.length && !loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-foreground">Send invoice on WhatsApp</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {pick(sendModal.invoice, 'invoiceNumber', 'invoice_number')} ·{' '}
                  {money(pick(sendModal.invoice, 'totalAmountKES', 'total_amount'))}
                </p>
              </div>
              <button type="button" onClick={() => setSendModal(null)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <label className="block text-xs">
              <span className="block font-semibold text-foreground mb-1.5">Client WhatsApp number</span>
              <input
                autoFocus
                value={sendModal.recipient}
                onChange={(e) => setSendModal({ ...sendModal, recipient: e.target.value })}
                placeholder="0712345678"
                className="w-full bg-surface border border-border rounded-xl p-2.5 font-mono text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
              />
            </label>
            <p className="text-[10px] text-muted-foreground">
              The generated PDF is attached as a real WhatsApp document. Delivery is logged with the
              gateway result.
            </p>
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={busy || !sendModal.recipient.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary-hover transition-all disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
