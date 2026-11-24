"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { buildAuditFieldDiff } from "@/lib/audit/diff";
import { maskSensitiveSnapshotForDisplay } from "@/lib/audit/mask-sensitive";
import {
  auditLogFiltersFromSearchParams,
  queryAuditLogs,
  type AuditLogListFilters,
} from "@/lib/audit/query";
import { AUDIT_REDACTED } from "@/lib/audit/redact-secrets";
import { auditTableNameTranslationKey } from "@/lib/audit/table-name-key";
import { formatDateTime } from "@/lib/format/datetime";
import { buildCsvWithBom } from "@/lib/export/csv";

export type AuditLogExportResult =
  | { success: true; data: { csv: string; filename: string } }
  | { success: false; error: string };
import { basePrisma, prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/prisma/record-audit-log";
import { getTranslations } from "next-intl/server";

function filtersFromRecord(
  input: Record<string, string | undefined>
): AuditLogListFilters {
  return auditLogFiltersFromSearchParams(input);
}

export async function exportAuditLogsCsv(
  input: Record<string, string | undefined>,
  locale: string
): Promise<AuditLogExportResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  const filters = filtersFromRecord(input);
  const { rows } = await queryAuditLogs({
    ...filters,
    page: 1,
    pageSize: 10_000,
  });

  const t = await getTranslations({ locale, namespace: "audit" });

  const headersRow = [
    t("export.columns.timestamp"),
    t("export.columns.action"),
    t("export.columns.table"),
    t("export.columns.recordId"),
    t("export.columns.user"),
    t("export.columns.ip"),
    t("export.columns.changes"),
  ];

  const dataRows = rows.map((log) => {
    const tableKey = auditTableNameTranslationKey(log.tableName);
    const tableName = tableKey ? t(tableKey) : log.tableName;
    const knownActions = [
      "CREATE",
      "UPDATE",
      "DELETE",
      "TWO_FACTOR_RESET",
      "PASSWORD_CHANGE",
      "SESSION_REVOKE",
      "EXPORT",
    ] as const;
    const actionLabel = knownActions.includes(
      log.action as (typeof knownActions)[number]
    )
      ? t(`actions.${log.action}`)
      : log.action;

    const oldMasked = maskSensitiveSnapshotForDisplay(
      (log.oldData as Record<string, unknown> | null) ?? null
    );
    const newMasked = maskSensitiveSnapshotForDisplay(
      (log.newData as Record<string, unknown> | null) ?? null
    );

    const diff = buildAuditFieldDiff(
      log.tableName,
      oldMasked,
      newMasked,
      locale === "ar" ? "ar" : "en"
    )
      .filter((row) => row.changed)
      .map((row) => `${row.label}: ${row.before} → ${row.after}`)
      .join("; ");

    return [
      formatDateTime(log.timestamp, locale),
      actionLabel,
      tableName,
      log.recordId,
      log.user?.name ?? t("systemUser"),
      log.ipAddress ?? "",
      diff || AUDIT_REDACTED,
    ];
  });

  const csv = buildCsvWithBom(headersRow, dataRows);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `audit-logs-${date}.csv`;

  const headersList = await headers();
  const ipAddress =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  await recordAuditLog(basePrisma, { userId: session.user.id, ipAddress }, {
    model: "AuditLog",
    action: "EXPORT",
    recordId: "filtered-export",
    newData: {
      rowCount: rows.length,
      filters: input,
    },
  });

  return { success: true, data: { csv, filename } };
}

export async function listAuditLogActors() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null, auditLogs: { some: {} } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 200,
  });

  return users;
}