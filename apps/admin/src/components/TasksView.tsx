'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  Plus,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Clock,
  User,
  ShieldAlert,
} from 'lucide-react';

interface TasksViewProps {
  token: string | null;
  apiUrl: string;
}

export const TasksView: React.FC<TasksViewProps> = ({ token, apiUrl }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    title: '',
    category: 'CLINICAL_HANDOVER',
    priority: 'HIGH',
    dueDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
  });

  const fetchTasks = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
      const res = await fetch(`${apiUrl}/tasks${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Tasks fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl, statusFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Operational handover task assigned.' });
        setIsModalOpen(false);
        setForm({
          title: '',
          category: 'CLINICAL_HANDOVER',
          priority: 'HIGH',
          dueDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
        });
        fetchTasks();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMsg({ type: 'error', text: err.message || 'Failed to create task.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error creating task.' });
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
              Task Management & Clinical Shift Handovers
            </h2>
            <p className="text-xs text-muted-foreground">
              MDT operational assignments, medication administration alerts, and nurse station handovers
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
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
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-border mt-3">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="px-4 py-3">Task Directive</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Due Deadline</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-2" />
                    <span>Loading shift tasks...</span>
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                    <CheckSquare className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-semibold text-foreground">No tasks currently pending</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Clinical handovers, patient vitals reviews, and store requests will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-subtle transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{t.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.category}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          t.priority === 'CRITICAL' || t.priority === 'HIGH'
                            ? 'bg-danger-soft text-danger'
                            : 'bg-primary-soft text-primary'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface border border-border text-foreground">
                        {t.status || 'PENDING'}
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
              <h3 className="font-serif text-lg font-bold text-foreground">Assign Staff Task</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-foreground font-semibold mb-1">Task Directive</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Conduct Day 3 CIWA-Ar withdrawal assessment for Bed 02"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
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
                    <option value="CLINICAL_HANDOVER">Clinical Handover</option>
                    <option value="MEDICATION_ROUND">Medication Round</option>
                    <option value="VITALS_CHECK">Detox Vitals Check</option>
                    <option value="FACILITY_MAINTENANCE">Facility Inspection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Due Deadline</label>
                <input
                  type="datetime-local"
                  required
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
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
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary-hover shadow-xs flex items-center space-x-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Assign Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
