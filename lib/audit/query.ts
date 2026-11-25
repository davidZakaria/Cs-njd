import type { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const AUDIT_LOG_PAGE_SIZE_DEFAULT = 25;
export const AUDIT_LOG_PAGE_SIZE_MAX = 100;

export type AuditLogListFilters = {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  actorId?: string;
  tableName?: string;
  action?: AuditAction;
  recordId?: string;
  q?: string;
};

function parsePage(value: string | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function parsePageSize(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return AUDIT_LOG_PAGE_SIZE_DEFAULT;
  return Math.min(Math.floor(n), AUDIT_LOG_PAGE_SIZE_MAX);
}

export function auditLogFiltersFromSearchParams(
  params: Record<string, string | string[] | undefined>
): AuditLogListFilters {
  const pick = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  return {
    page: parsePage(pick("page"), 1),
    pageSize: parsePageSize(pick("pageSize")),
    dateFrom: pick("dateFrom")?.trim() || undefined,
    dateTo: pick("dateTo")?.trim() || undefined,
    actorId: pick("actorId")?.trim() || undefined,
    tableName: pick("tableName")?.trim() || undefined,
    action: pick("action")?.trim() as AuditAction | undefined,
    recordId: pick("recordId")?.trim() || undefined,
    q: pick("q")?.trim() || undefined,
  };
}

function buildWhere(filters: AuditLogListFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    if (!Number.isNaN(from.getTime())) {
      and.push({ timestamp: { gte: from } });
    }
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      and.push({ timestamp: { lte: to } });
    }
  }
  if (filters.actorId) {
    and.push({ userId: filters.actorId });
  }
  if (filters.tableName) {
    and.push({ tableName: filters.tableName });
  }
  if (filters.action) {
    and.push({ action: filters.action });
  }
  if (filters.recordId) {
    and.push({ recordId: { contains: filters.recordId, mode: "insensitive" } });
  }
  if (filters.q) {
    const q = filters.q;
    and.push({
      OR: [
        { recordId: { contains: q, mode: "insensitive" } },
        { tableName: { contains: q, mode: "insensitive" } },
        { ipAddress: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  return and.length ? { AND: and } : {};
}

export async function queryAuditLogs(filters: AuditLogListFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? AUDIT_LOG_PAGE_SIZE_DEFAULT;
  const where = buildWhere(filters);

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}