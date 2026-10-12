'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PackageCheck,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  Layers,
  ArrowDownCircle,
} from 'lucide-react';

interface InventoryViewProps {
  token: string | null;
  apiUrl: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ token, apiUrl }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    category: 'MEDICAL_CONSUMABLES',
    unit: 'Pieces',
    quantity: 100,
    minAlertQty: 20,
    unitCostKES: 250,
  });

  const fetchItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = categoryFilter !== 'ALL' ? `?category=${categoryFilter}` : '';
      const res = await fetch(`${apiUrl}/inventory/items${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Inventory fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl, categoryFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/inventory/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          unit: form.unit,
          quantity: Number(form.quantity),
          minAlertQty: Number(form.minAlertQty),
          unitCostKES: Number(form.unitCostKES),
        }),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Consumable inventory stock item registered.' });
        setIsModalOpen(false);
        setForm({
          name: '',
          category: 'MEDICAL_CONSUMABLES',
          unit: 'Pieces',
          quantity: 100,
          minAlertQty: 20,
          unitCostKES: 250,
        });
        fetchItems();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMsg({ type: 'error', text: err.message || 'Failed to add inventory item.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error adding inventory item.' });
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
              Facility Stores & General Inventory
            </h2>
            <p className="text-xs text-muted-foreground">
              Medical consumables, detox testing reagents, bedding, hygiene stock, and reorder levels
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Inventory Item</span>
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

        {/* Filter bar */}
        <div className="flex gap-3 pt-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-surface-subtle border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="MEDICAL_CONSUMABLES">Medical & Nursing Supplies</option>
            <option value="DETOX_REAGENTS">Detox Reagents & Multi-Drug Test Panels</option>
            <option value="LINEN_BEDDING">Linen & Patient Bedding</option>
            <option value="HYGIENE_CLEANING">Sanitation & Hygiene Consumables</option>
          </select>
        </div>

        {/* Inventory Table */}
        <div className="overflow-x-auto rounded-xl border border-border mt-3">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="px-4 py-3">Item Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-4 py-3">Re-order Level</th>
                <th className="px-4 py-3">Unit Cost (KES)</th>
                <th className="px-4 py-3">Stock Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-2" />
                    <span>Loading inventory catalog...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    <PackageCheck className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-semibold text-foreground">No stock items found in inventory catalog</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Click &quot;Add Inventory Item&quot; above to register clinical consumables, linen, or reagents.
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="hover:bg-surface-subtle transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{it.name || it.itemName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{it.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">{it.unit || it.unitOfMeasure}</td>
                    <td className="px-4 py-3 font-mono font-bold text-foreground">
                      {it.quantity ?? it.currentStock ?? 0}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {it.minAlertQty ?? it.minimumReorderLevel ?? 0}
                    </td>
                    <td className="px-4 py-3 font-mono text-foreground">
                      KES {Number(it.unitCostKES ?? it.unitCost ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {(it.quantity ?? it.currentStock ?? 0) <= (it.minAlertQty ?? it.minimumReorderLevel ?? 0) ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-danger-soft text-danger">
                          Reorder Required
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-soft text-success">
                          Healthy Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Item */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="font-serif text-lg font-bold text-foreground">Add Consumable Inventory Item</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-foreground font-semibold mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10-Panel Drug Screen Urine Test Cassettes"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                    <option value="MEDICAL_CONSUMABLES">Medical Supplies</option>
                    <option value="DETOX_REAGENTS">Detox Reagents</option>
                    <option value="LINEN_BEDDING">Linen & Bedding</option>
                    <option value="HYGIENE_CLEANING">Sanitation & Hygiene</option>
                  </select>
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    required
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Current Qty</label>
                  <input
                    type="number"
                    required
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Min Re-order</label>
                  <input
                    type="number"
                    required
                    value={form.minAlertQty}
                    onChange={(e) => setForm({ ...form, minAlertQty: Number(e.target.value) })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Unit Cost (KES)</label>
                  <input
                    type="number"
                    required
                    value={form.unitCostKES}
                    onChange={(e) => setForm({ ...form, unitCostKES: Number(e.target.value) })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none"
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
                  <span>Save Item</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
