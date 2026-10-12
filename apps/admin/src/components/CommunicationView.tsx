'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Smile,
  Send,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Star,
  Phone,
  BarChart2,
} from 'lucide-react';

interface CommunicationViewProps {
  token: string | null;
  apiUrl: string;
}

export const CommunicationView: React.FC<CommunicationViewProps> = ({ token, apiUrl }) => {
  const [activeTab, setActiveTab] = useState<'communication' | 'feedback'>('communication');
  const [commLogs, setCommLogs] = useState<any[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [sendForm, setSendForm] = useState({
    recipient: '',
    channel: 'SMS',
    subject: '',
    body: '',
  });

  const [surveyForm, setSurveyForm] = useState({
    rating: 5,
    cleanlinessScore: 5,
    counsellingScore: 5,
    foodQualityScore: 5,
    nursingScore: 5,
    comments: '',
  });

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/communication/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCommLogs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Comm logs fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl]);

  const fetchFeedback = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/feedback/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFeedbackSummary(data);
      }
    } catch (err) {
      console.warn('Feedback summary fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl]);

  useEffect(() => {
    if (activeTab === 'communication') fetchLogs();
    if (activeTab === 'feedback') fetchFeedback();
  }, [activeTab, fetchLogs, fetchFeedback]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/communication/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(sendForm),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Communication queued and dispatched to telecom gateway.' });
        setIsModalOpen(false);
        setSendForm({ recipient: '', channel: 'SMS', subject: '', body: '' });
        fetchLogs();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMsg({ type: 'error', text: err.message || 'Failed to dispatch communication.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error dispatching message.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/feedback/surveys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(surveyForm),
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Patient satisfaction survey recorded.' });
        setFeedbackModalOpen(false);
        fetchFeedback();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedbackMsg({ type: 'error', text: err.message || 'Failed to submit survey.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error submitting survey.' });
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
              Communications, WhatsApp Gateway & Patient Experience
            </h2>
            <p className="text-xs text-muted-foreground">
              Automated appointment reminders, family broadcast SMS, and continuous NPS feedback
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {activeTab === 'communication' ? (
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs transition"
              >
                <Send className="w-4 h-4" />
                <span>Send SMS / Broadcast</span>
              </button>
            ) : (
              <button
                onClick={() => setFeedbackModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs transition"
              >
                <Star className="w-4 h-4" />
                <span>Record Survey</span>
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

        <div className="flex border-b border-border space-x-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('communication')}
            className={`pb-2.5 transition border-b-2 ${
              activeTab === 'communication'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Outbound SMS & WhatsApp Logs
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`pb-2.5 transition border-b-2 ${
              activeTab === 'feedback'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Patient Satisfaction & NPS Analytics
          </button>
        </div>

        {activeTab === 'communication' && (
          <div className="overflow-x-auto rounded-xl border border-border mt-3">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3">Recipient (+254)</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Message Body</th>
                  <th className="px-4 py-3">Dispatch Gateway Ref</th>
                  <th className="px-4 py-3">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && commLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                      <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-2" />
                      <span>Loading communication logs...</span>
                    </td>
                  </tr>
                ) : commLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                      <MessageSquare className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="font-semibold text-foreground">No communication broadcasts sent yet</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Appointment reminder SMS and family support broadcasts will appear here upon dispatch.
                      </p>
                    </td>
                  </tr>
                ) : (
                  commLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-surface-subtle transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-foreground">{l.recipient}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-soft text-primary">
                          {l.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground max-w-sm truncate">{l.body}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{l.providerRef || 'GATEWAY-OK'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          {l.status || 'DELIVERED'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Surveys Evaluated</span>
                <div className="text-2xl font-bold font-serif text-foreground mt-1">
                  {feedbackSummary?.totalSurveys ?? 0}
                </div>
                <span className="text-[10px] text-primary">Discharged & Active</span>
              </div>
              <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Average Rating</span>
                <div className="text-2xl font-bold font-serif text-emerald-600 mt-1">
                  {feedbackSummary?.averageRating ?? '0.0'} / 5.0
                </div>
                <span className="text-[10px] text-emerald-600">Client Satisfaction</span>
              </div>
              <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Net Promoter Score (NPS)</span>
                <div className="text-2xl font-bold font-serif text-foreground mt-1">
                  {feedbackSummary?.npsScore ?? 0}
                </div>
                <span className="text-[10px] text-success">Institutional Trust</span>
              </div>
              <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Therapy Score</span>
                <div className="text-2xl font-bold font-serif text-secondary mt-1">
                  {feedbackSummary?.categoryAverages?.counselling ?? '0.0'} / 5.0
                </div>
                <span className="text-[10px] text-secondary">Counselling Dept</span>
              </div>
            </div>

            {feedbackSummary?.totalSurveys === 0 && (
              <div className="p-8 rounded-xl bg-surface-subtle border border-border text-center space-y-2 mt-4">
                <Smile className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-xs font-semibold text-foreground">No patient feedback surveys recorded yet</p>
                <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                  Post-discharge surveys and family experience evaluations will compute satisfaction averages here once submitted.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="font-serif text-lg font-bold text-foreground">Send Client Communication</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendMessage} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Channel</label>
                  <select
                    value={sendForm.channel}
                    onChange={(e) => setSendForm({ ...sendForm, channel: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  >
                    <option value="SMS">Safaricom SMS</option>
                    <option value="WHATSAPP">WhatsApp Message</option>
                  </select>
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Recipient (+254)</label>
                  <input
                    type="text"
                    required
                    placeholder="+2547XXXXXXXX"
                    value={sendForm.recipient}
                    onChange={(e) => setSendForm({ ...sendForm, recipient: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Message Body</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Dear Family, this is Calyvia Wellness Center confirming your consultation tomorrow at 10:00 AM..."
                  value={sendForm.body}
                  onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })}
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
                  <span>Dispatch Message</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {feedbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="font-serif text-lg font-bold text-foreground">Record Patient Satisfaction Survey</h3>
              <button onClick={() => setFeedbackModalOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitSurvey} className="space-y-3 text-xs">
              <div>
                <label className="block text-foreground font-semibold mb-1">Overall Satisfaction (1 to 5)</label>
                <select
                  value={surveyForm.rating}
                  onChange={(e) => setSurveyForm({ ...surveyForm, rating: Number(e.target.value) })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                >
                  <option value={5}>5 Stars - Outstanding</option>
                  <option value={4}>4 Stars - Good</option>
                  <option value={3}>3 Stars - Satisfactory</option>
                  <option value={2}>2 Stars - Needs Improvement</option>
                  <option value={1}>1 Star - Unsatisfactory</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Counselling Score</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={surveyForm.counsellingScore}
                    onChange={(e) => setSurveyForm({ ...surveyForm, counsellingScore: Number(e.target.value) })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Nursing Care Score</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={surveyForm.nursingScore}
                    onChange={(e) => setSurveyForm({ ...surveyForm, nursingScore: Number(e.target.value) })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Feedback Comments</label>
                <textarea
                  rows={2}
                  placeholder="Patient testimonials or areas for institutional improvement..."
                  value={surveyForm.comments}
                  onChange={(e) => setSurveyForm({ ...surveyForm, comments: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setFeedbackModalOpen(false)}
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
                  <span>Save Survey</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
