'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  Filter,
  Loader2,
  Monitor,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { ROLE_DISPLAY_NAMES } from '@calyvia/shared';

interface AccountRef {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuditLog {
  id: string;
  timestamp?: string;
  userId?: string | null;
  role?: string | null;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  actor?: AccountRef | null;
  user?: AccountRef | null;
  targetAccount?: AccountRef | null;
  description?: string;
  severity?: 'success' | 'attention' | 'info' | string;
  context?: any;
  newValues?: any;
  diffJson?: any;
}

interface AuditTrailViewProps {
  logs: AuditLog[];
  loading?: boolean;
  error?: string | null;
  canManageStaff: boolean;
  onManageStaff: () => void;
  onRefresh: () => void;
}

type Severity = 'success' | 'attention' | 'info';

const ROLE_LABELS = ROLE_DISPLAY_NAMES as Record<string, string>;

function pretty(value?: string | null): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function roleLabel(role?: string | null): string {
  if (!role) return 'Unauthenticated';
  return ROLE_LABELS[role] || pretty(role);
}

function formatWhen(timestamp?: string): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Nairobi',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function relativeWhen(timestamp?: string): string {
  if (!timestamp) return '';
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return '';
  const diff = Date.now() - time;
  if (diff < 0) return 'just now';
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function initials(account?: AccountRef | null, fallback?: string): string {
  const source = account?.fullName || account?.email || fallback || '?';
  const parts = source.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function severityOf(log: AuditLog): Severity {
  if (log.severity === 'success' || log.severity === 'attention' || log.severity === 'info') {
    return log.severity;
  }
  if (/FAILED|REJECTED|REVOKE|ERROR/i.test(log.action)) return 'attention';
  if (/SUCCESS|APPROVED|CREATE|UPDATE|RESET|PUBLISH|RECORD|PROCESS/i.test(log.action)) return 'success';
  return 'info';
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({
  logs,
  loading = false,
  error = null,
  canManageStaff,
  onManageStaff,
  onRefresh,
}) => {
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const actions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).sort(),
    [logs],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (severityFilter !== 'all' && severityOf(log) !== severityFilter) return false;
      if (!needle) return true;

      const actor = log.actor || log.user;
      const haystack = [
        log.description,
        log.action,
        log.resource,
        log.resourceId,
        actor?.fullName,
        actor?.email,
        actor?.role,
        log.targetAccount?.fullName,
        log.targetAccount?.email,
        log.ipAddress,
        formatWhen(log.timestamp),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [logs, query, actionFilter, severityFilter]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      total: logs.length,
      today: logs.filter((log) => log.timestamp && new Date(log.timestamp) >= today).length,
      accountEvents: logs.filter((log) =>
        /STAFF|USER|EMPLOYEE|LOGIN|LOGOUT|PASSWORD|AUTH/i.test(`${log.action} ${log.resource || ''}`),
      ).length,
      attention: logs.filter((log) => severityOf(log) === 'attention').length,
    };
  }, [logs]);

  const exportCsv = () => {
    const header = [
      'Timestamp',
      'Actor',
      'Actor email',
      'Role',
      'Event',
      'Action code',
      'Specific account',
      'Resource',
      'IP address',
      'User agent',
      'Status',
    ];
    const rows = filtered.map((log) => {
      const actor = log.actor || log.user;
      return [
        formatWhen(log.timestamp),
        actor?.fullName || 'System',
        actor?.email || '',
        roleLabel(log.role || actor?.role),
        log.description || pretty(log.action),
        log.action,
        log.targetAccount?.email || log.resourceId || '',
        pretty(log.resource),
        log.ipAddress || '',
        log.userAgent || '',
        severityOf(log),
      ];
    });
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `calyvia-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2 className="font-serif text-xl font-bold text-foreground">Security &amp; Audit Trail</h2>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              An immutable, searchable record of <strong className="text-foreground">who</strong> did{' '}
              <strong className="text-foreground">what</strong>, <strong className="text-foreground">when</strong>,
              and to <strong className="text-foreground">which account</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-primary-soft text-primary text-[11px] font-bold rounded-full border border-primary/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Immutable log</span>
            </span>
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-surface-elevated text-muted-foreground text-[11px] font-semibold rounded-full border border-border">
              <Activity className="w-3.5 h-3.5" />
              <span>Times shown in EAT</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Recorded events', value: stats.total, icon: Activity, tone: 'text-primary' },
            { label: 'Today', value: stats.today, icon: CheckCircle2, tone: 'text-emerald-600' },
            { label: 'Account & access events', value: stats.accountEvents, icon: Users, tone: 'text-blue-600' },
            { label: 'Needs attention', value: stats.attention, icon: AlertCircle, tone: 'text-danger' },
          ].map((stat) => (
            <div key={stat.label} className="p-3.5 rounded-xl bg-surface-subtle border border-border">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {stat.label}
                </p>
                <stat.icon className={`w-4 h-4 ${stat.tone}`} />
              </div>
              <p className="mt-1.5 text-lg font-bold text-foreground font-mono">{stat.value}</p>
            </div>
          ))}
        </div>

        {canManageStaff && (
          <div className="p-4 rounded-xl bg-surface-subtle border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">
                  Personnel Credential &amp; Access Management
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Provision staff accounts, assign login emails, allocate roles, and revoke employee access.
                </div>
              </div>
            </div>
            <button
              onClick={onManageStaff}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all self-start sm:self-auto shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Manage Staff Accounts</span>
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search actor, account, action, resource or IP…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                className="appearance-none pl-8 pr-8 py-2.5 rounded-xl bg-surface border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 max-w-[190px]"
              >
                <option value="all">All actions</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {pretty(action)}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              className="px-3 py-2.5 rounded-xl bg-surface border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All statuses</option>
              <option value="success">Completed</option>
              <option value="attention">Needs attention</option>
              <option value="info">Recorded</option>
            </select>
            <button
              onClick={exportCsv}
              title="Export visible audit events"
              className="p-2.5 rounded-xl bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onRefresh}
              title="Refresh audit trail"
              className="p-2.5 rounded-xl bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[1180px] text-left text-xs">
            <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">What happened</th>
                <th className="px-4 py-3">Specific account / record</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xs text-muted-foreground">
                    <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin text-primary" />
                    Loading audit trail…
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((log) => {
                  const actor = log.actor || log.user;
                  const target = log.targetAccount;
                  const severity = severityOf(log);
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelected(log)}
                      className="hover:bg-surface-subtle transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="font-mono text-[11px] text-foreground">{formatWhen(log.timestamp)}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{relativeWhen(log.timestamp)}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-primary-soft text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {initials(actor, log.userId ? 'System user' : 'System')}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground truncate max-w-[170px]">
                              {actor?.fullName || 'System / unauthenticated'}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[170px]">
                              {actor?.email || log.userId || 'No account attached'}
                            </div>
                          </div>
                        </div>
                        <span className="mt-1.5 inline-block text-[9px] font-semibold uppercase tracking-wide text-secondary">
                          {roleLabel(log.role || actor?.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-foreground">{log.description || pretty(log.action)}</div>
                        <code className="text-[10px] text-primary bg-primary-soft/40 px-1.5 py-0.5 rounded">
                          {log.action}
                        </code>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {target ? (
                          <>
                            <div className="font-semibold text-foreground">{target.fullName}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{target.email}</div>
                          </>
                        ) : log.resourceId ? (
                          <>
                            <div className="font-mono text-[11px] text-foreground break-all">{log.resourceId}</div>
                            <div className="text-[10px] text-muted-foreground">No linked user account</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        <div className="text-[10px] text-secondary mt-1">{pretty(log.resource)}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-mono text-[11px] text-foreground">{log.ipAddress || '—'}</div>
                        <div
                          className="text-[10px] text-muted-foreground max-w-[170px] truncate"
                          title={log.userAgent || ''}
                        >
                          {log.userAgent ? (
                            <span className="inline-flex items-center space-x-1">
                              <Monitor className="w-3 h-3 inline" />
                              <span>{log.userAgent}</span>
                            </span>
                          ) : (
                            'Unknown client'
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${
                            severity === 'attention'
                              ? 'bg-danger-soft text-danger border-danger/20'
                              : severity === 'success'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-surface-elevated text-muted-foreground border-border'
                          }`}
                        >
                          {severity === 'attention' ? (
                            <AlertCircle className="w-3 h-3" />
                          ) : severity === 'success' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Activity className="w-3 h-3" />
                          )}
                          <span>
                            {severity === 'attention'
                              ? 'Needs attention'
                              : severity === 'success'
                                ? 'Completed'
                                : 'Recorded'}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(log);
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary-soft transition-colors"
                          title="View full audit record"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <ShieldCheck className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-xs font-semibold text-foreground">No matching audit events</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {logs.length === 0
                        ? 'Events appear here as staff sign in and make changes.'
                        : 'Try a different search or filter.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Showing {filtered.length} of {logs.length} recorded events. Audit records are append-only and retained for
          institutional compliance.
        </p>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-elevated"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-border">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-primary">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Audit record</span>
                </div>
                <h3 className="font-serif text-lg font-bold text-foreground">
                  {selected.description || pretty(selected.action)}
                </h3>
                <p className="text-[11px] text-muted-foreground">{formatWhen(selected.timestamp)} EAT</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetailCard title="Who" value={selected.actor?.fullName || 'System / unauthenticated'} sub={selected.actor?.email || selected.userId || 'No account attached'} />
              <DetailCard title="Role" value={roleLabel(selected.role || selected.actor?.role)} sub={selected.role || '—'} />
              <DetailCard title="What" value={pretty(selected.action)} sub={selected.action} monoSub />
              <DetailCard title="When" value={formatWhen(selected.timestamp)} sub={`${relativeWhen(selected.timestamp)} · East Africa Time`} />
              <DetailCard
                title="Specific account / record"
                value={selected.targetAccount?.fullName || selected.resourceId || '—'}
                sub={selected.targetAccount?.email || pretty(selected.resource)}
              />
              <DetailCard title="Source" value={selected.ipAddress || '—'} sub={selected.userAgent || 'Unknown client'} monoValue />
              <div className="sm:col-span-2 p-3 rounded-xl bg-surface-subtle border border-border">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                  Record ID
                </p>
                <p className="font-mono text-[11px] text-foreground break-all">{selected.id}</p>
              </div>
            </div>

            {(() => {
              const context = selected.context || selected.newValues || selected.diffJson;
              if (!context) return null;
              return (
                <div className="px-5 pb-5">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                    Event context
                  </p>
                  <pre className="p-3 rounded-xl bg-surface-subtle border border-border text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap break-all font-mono">
                    {JSON.stringify(context, null, 2)}
                  </pre>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

function DetailCard({
  title,
  value,
  sub,
  monoValue = false,
  monoSub = false,
}: {
  title: string;
  value: string;
  sub?: string;
  monoValue?: boolean;
  monoSub?: boolean;
}) {
  return (
    <div className="p-3 rounded-xl bg-surface-subtle border border-border min-w-0">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{title}</p>
      <p className={`text-xs font-semibold text-foreground break-words ${monoValue ? 'font-mono' : ''}`}>
        {value || '—'}
      </p>
      {sub && (
        <p className={`text-[10px] text-muted-foreground mt-0.5 break-all ${monoSub ? 'font-mono' : ''}`}>
          {sub}
        </p>
      )}
    </div>
  );
}
