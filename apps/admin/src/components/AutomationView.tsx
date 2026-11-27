'use client';

import React, { useState } from 'react';
import {
  Webhook,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Play,
  Loader2,
  Globe,
  Radio,
  Server,
  Key,
} from 'lucide-react';

interface AutomationViewProps {
  token: string | null;
  apiUrl: string;
}

export const AutomationView: React.FC<AutomationViewProps> = ({ token, apiUrl }) => {
  const [activeTab, setActiveTab] = useState<'integrations' | 'automation'>('integrations');
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleTriggerJob = async (endpoint: string, label: string) => {
    if (!token) return;
    setTriggeringJob(endpoint);
    setStatusMsg(null);
    try {
      const res = await fetch(`${apiUrl}/automation/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = await res.json().catch(() => ({}));
        const notConfigured = result?.status === 'NOT_CONFIGURED';
        setStatusMsg({
          type: notConfigured ? 'error' : 'success',
          text: result?.message || `Job executed: ${label} triggered successfully.`,
        });
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMsg({ type: 'error', text: err.message || `Failed to trigger ${label}.` });
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Network error executing scheduled automation job.' });
    } finally {
      setTriggeringJob(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-foreground">
              Integrations, Webhooks & Automated Schedulers
            </h2>
            <p className="text-xs text-muted-foreground">
              Safaricom Daraja Lipa Na M-Pesa STK, website enquiry endpoints, and manual job triggers
            </p>
          </div>
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-semibold rounded-full self-start sm:self-auto">
            Configured Integrations
          </span>
        </div>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                : 'bg-danger-soft border-danger/20 text-danger'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="flex border-b border-border space-x-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('integrations')}
            className={`pb-2.5 transition border-b-2 ${
              activeTab === 'integrations'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Connected Gateways & Webhooks
          </button>
          <button
            onClick={() => setActiveTab('automation')}
            className={`pb-2.5 transition border-b-2 ${
              activeTab === 'automation'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Automated Clinical Schedulers
          </button>
        </div>

        {activeTab === 'integrations' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
            {/* Safaricom Daraja */}
            <div className="p-5 rounded-2xl bg-surface-subtle border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-bold text-foreground">
                  <Server className="w-4 h-4 text-emerald-600" />
                  <span>Safaricom Daraja API Gateway</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  CONFIGURED
                </span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Handles instant Lipa Na M-Pesa Online STK Push requests for patient admissions, consultations, and deposits directly into Calyvia treasury accounts.
              </p>
              <div className="p-2.5 bg-surface rounded-xl border border-border font-mono text-[10px] text-muted-foreground space-y-1">
                <div><strong>Endpoint:</strong> /api/v1/integrations/mpesa/callback</div>
                <div><strong>Handshake:</strong> TLS 1.3 / OAuth 2.0 Bearer</div>
                <div><strong>Environment:</strong> Production Safaricom Daraja</div>
              </div>
            </div>

            {/* Public Website Webhook */}
            <div className="p-5 rounded-2xl bg-surface-subtle border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-bold text-foreground">
                  <Globe className="w-4 h-4 text-primary" />
                  <span>Website Intake Lead Webhook</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-soft text-primary border border-primary/20">
                  ENDPOINT READY
                </span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Asynchronously consumes admission inquiries submitted from the official Calyvia Wellness Center web portal and routes them into the CRM triage pipeline.
              </p>
              <div className="p-2.5 bg-surface rounded-xl border border-border font-mono text-[10px] text-muted-foreground space-y-1">
                <div><strong>Webhook URL:</strong> https://api.calyviawellness.co.ke/api/v1/integrations/webhook/website-lead</div>
                <div><strong>Origin:</strong> https://calyviawellness.co.ke</div>
                <div><strong>Target:</strong> CRM Triage & Helpline Desk</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'automation' && (
          <div className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Job 1: Detox Vitals Alert Monitor */}
              <div className="p-5 rounded-2xl bg-surface-subtle border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-bold text-foreground">
                    <Zap className="w-4 h-4 text-warning" />
                    <span>Detox Vitals Overdue Alert Job</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning-soft text-warning">
                    NOT SCHEDULED
                  </span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Manual evaluation endpoint. No background scheduler is currently connected, so triggering it only reports that no vitals alerts were dispatched.
                </p>
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground">Queue: not configured</span>
                  <button
                    onClick={() => handleTriggerJob('jobs/vitals-monitor', 'Detox Vitals Alert Monitor')}
                    disabled={triggeringJob === 'jobs/vitals-monitor'}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary-hover shadow-xs transition disabled:opacity-60"
                  >
                    {triggeringJob === 'jobs/vitals-monitor' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>Trigger Now</span>
                  </button>
                </div>
              </div>

              {/* Job 2: Aftercare Cadence Dispatcher */}
              <div className="p-5 rounded-2xl bg-surface-subtle border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-bold text-foreground">
                    <Radio className="w-4 h-4 text-secondary" />
                    <span>Aftercare Cadence Dispatcher</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary-soft text-secondary">
                    NOT SCHEDULED
                  </span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Manual evaluation endpoint. No background scheduler is currently connected, so triggering it only reports that no aftercare reminders were dispatched.
                </p>
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground">Queue: not configured</span>
                  <button
                    onClick={() => handleTriggerJob('jobs/aftercare-cadence', 'Aftercare Cadence Dispatcher')}
                    disabled={triggeringJob === 'jobs/aftercare-cadence'}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary-hover shadow-xs transition disabled:opacity-60"
                  >
                    {triggeringJob === 'jobs/aftercare-cadence' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>Trigger Now</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
