import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface PublicAccountRef {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuditQuery {
  resource?: string;
  action?: string;
  actorId?: string;
  limit?: number;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Successful staff sign-in',
  LOGIN_FAILED: 'Failed staff sign-in',
  USER_LOGOUT: 'Signed out',
  USER_PASSWORD_CHANGE: 'Changed own password',
  USER_PROFILE_UPDATE: 'Updated own profile',
  STAFF_ACCOUNT_CREATED: 'Created staff account',
  CREATE_STAFF_ACCOUNT: 'Created staff account',
  STAFF_ACCOUNT_UPDATED: 'Updated staff account',
  UPDATE_STAFF_ACCOUNT: 'Updated staff account',
  STAFF_PASSWORD_RESET_BY_ADMIN: 'Reset staff password',
  RESET_STAFF_PASSWORD: 'Reset staff password',
  STAFF_ACCOUNT_STATUS_CHANGED: 'Changed staff account status',
  UPDATE_STAFF_STATUS: 'Changed staff account status',
  USER_ACCOUNT_STATUS_UPDATED: 'Changed account status',
  EMPLOYEE_ACCOUNT_APPROVED: 'Approved employee account',
  EMPLOYEE_ACCOUNT_REJECTED: 'Declined employee access request',
  DELETE_BED: 'Deactivated bed',
  DELETE_PATIENT: 'Archived patient record',
  DELETE_INVOICE: 'Deleted invoice',
  DELETE_FAMILY_CONTACT: 'Removed family contact',
  DELETE_COMMUNICATION_LOG: 'Deleted communication log',
  PUBLISH_CMS_POST: 'Published website post',
  UNPUBLISH_CMS_POST: 'Unpublished website post',
};

function humanize(value?: string | null): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function describeAction(action: string, resource?: string | null): string {
  const label = ACTION_LABELS[action] || humanize(action) || 'Recorded event';
  const target = humanize(resource);
  return target ? `${label} · ${target}` : label;
}

function severityFor(action: string): 'success' | 'attention' | 'info' {
  if (/FAILED|REJECTED|REVOKE|ERROR/i.test(action)) return 'attention';
  if (/SUCCESS|APPROVED|CREATE|UPDATE|RESET|PUBLISH|RECORD|PROCESS/i.test(action)) return 'success';
  return 'info';
}

const SENSITIVE_KEY = /(password|passwd|secret|token|authorization|api[_ -]?key|private[_ -]?key)/i;

function sanitizeContext(value: any, depth = 0): any {
  if (!value || typeof value !== 'object' || depth > 4) return value ?? null;
  if (Array.isArray(value)) return value.map((item) => sanitizeContext(item, depth + 1));
  const clean: Record<string, any> = {};
  for (const [key, item] of Object.entries(value)) {
    clean[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeContext(item, depth + 1);
  }
  return clean;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async logAction(data: {
    userId?: string;
    role?: string;
    action: string;
    resource: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    diffJson?: any;
  }) {
    try {
      if (this.prisma && this.prisma.auditLog) {
        return await this.prisma.auditLog.create({
          data: {
            userId: data.userId || null,
            role: data.role || 'ANONYMOUS',
            action: data.action,
            resource: data.resource,
            resourceId: data.resourceId || null,
            ipAddress: data.ipAddress || '127.0.0.1',
            userAgent: data.userAgent || 'system',
            // The physical column is new_values; diff_json does not exist.
            newValues: data.diffJson || null,
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Audit record insertion skipped: ${(err as Error)?.message || err}`);
    }
    return null;
  }

  async getAuditLogs(query?: AuditQuery) {
    const requestedLimit = Number(query?.limit) || 50;
    const limit = Math.min(Math.max(requestedLimit, 1), 200);

    try {
      if (this.prisma && this.prisma.auditLog) {
        const logs = await this.prisma.auditLog.findMany({
          where: {
            ...(query?.resource ? { resource: { contains: query.resource } } : {}),
            ...(query?.action ? { action: query.action } : {}),
            ...(query?.actorId ? { userId: query.actorId } : {}),
          },
          orderBy: { timestamp: 'desc' },
          take: limit,
        });

        const accounts = await this.loadPublicAccounts(logs);

        return logs.map((log: any) => {
          const actor = log.userId ? accounts.get(String(log.userId)) || null : null;
          const targetAccount = log.resourceId
            ? accounts.get(String(log.resourceId)) ||
              (log.action?.startsWith('LOGIN') && actor ? actor : null)
            : null;

          const context = sanitizeContext(log.newValues || log.diffJson || null);
          return {
            ...log,
            // `user` is kept for older consumers; `actor` is the clearer name.
            actor,
            user: actor,
            targetAccount,
            description: describeAction(log.action, log.resource),
            severity: severityFor(log.action),
            // Replace the raw fields too so a future audit write cannot leak secrets.
            newValues: context,
            oldValues: sanitizeContext(log.oldValues || null),
            context,
          };
        });
      }
    } catch (err) {
      this.logger.warn(`Audit logs fetch error: ${(err as Error)?.message || err}`);
    }
    return [];
  }

  private async loadPublicAccounts(logs: any[]): Promise<Map<string, PublicAccountRef>> {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ids = Array.from(
      new Set(
        logs
          .flatMap((log) => [log.userId, log.resourceId])
          .filter(Boolean)
          .map(String)
          .filter((id) => uuidPattern.test(id)),
      ),
    );

    const accounts = new Map<string, PublicAccountRef>();
    if (!ids.length || typeof (this.prisma as any).query !== 'function') return accounts;

    try {
      const result = await (this.prisma as any).query(
        'SELECT id, email, full_name, role FROM public.users WHERE id = ANY($1::uuid[])',
        [ids],
      );
      for (const row of result?.rows || []) {
        accounts.set(String(row.id), {
          id: row.id,
          email: row.email,
          fullName: row.full_name,
          role: row.role,
        });
      }
    } catch (err) {
      this.logger.warn(`Audit actor lookup failed: ${(err as Error)?.message || err}`);
    }

    return accounts;
  }
}
