import { prisma } from "@/lib/prisma";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime } from "@/lib/format/datetime";
import { AuditLogsTable } from "@/components/audit/audit-logs-table";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  await requireSuperAdmin();
  const [locale, t] = await Promise.all([getLocale(), getTranslations("audit")]);

  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { timestamp: "desc" },
    take: 500,
  });

  const rows = logs.map((log) => ({
    id: log.id,
    action: log.action,
    tableName: log.tableName,
    user: log.user?.name ?? t("systemUser"),
    timestamp: formatDateTime(log.timestamp, locale),
    ipAddress: log.ipAddress ?? "—",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <AuditLogsTable rows={rows} />
    </div>
  );
}
