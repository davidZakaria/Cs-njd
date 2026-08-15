import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AuditLogsTable } from "@/components/audit/audit-logs-table";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

export default async function AuditLogsPage() {
  await requireSuperAdmin();
  const t = await getTranslations("audit");

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
    timestamp: log.timestamp.toLocaleString(),
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
