import { listAuditLogActors } from "@/lib/actions/audit-logs";
import { auditTableNameTranslationKey } from "@/lib/audit/table-name-key";
import {
  auditLogFiltersFromSearchParams,
  queryAuditLogs,
} from "@/lib/audit/query";
import { AuditLogsPanel } from "@/components/audit/audit-logs-panel";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { formatDateTime } from "@/lib/format/datetime";
import { getLocale, getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ACTION_KEYS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "TWO_FACTOR_RESET",
  "PASSWORD_CHANGE",
  "SESSION_REVOKE",
  "EXPORT",
] as const;

function jsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireSuperAdmin();
  const [locale, t, resolvedSearch] = await Promise.all([
    getLocale(),
    getTranslations("audit"),
    searchParams,
  ]);

  const filters = auditLogFiltersFromSearchParams(resolvedSearch);
  const [{ rows, total, page, pageCount, pageSize }, actors] = await Promise.all([
    queryAuditLogs(filters),
    listAuditLogActors(),
  ]);

  const listRows = rows.map((log) => {
    const tableKey = auditTableNameTranslationKey(log.tableName);
    const tableName = tableKey ? t(tableKey) : log.tableName;
    const actionLabel =
      ACTION_KEYS.includes(log.action as (typeof ACTION_KEYS)[number])
        ? t(`actions.${log.action}`)
        : log.action;

    return {
      id: log.id,
      action: actionLabel,
      actionKey: log.action,
      tableName,
      tableKey: log.tableName,
      recordId: log.recordId,
      user: log.user?.name ?? t("systemUser"),
      timestamp: formatDateTime(log.timestamp, locale),
      ipAddress: log.ipAddress ?? "—",
      oldData: jsonObject(log.oldData),
      newData: jsonObject(log.newData),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <AuditLogsPanel
        rows={listRows}
        total={total}
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        actors={actors}
      />
    </div>
  );
}