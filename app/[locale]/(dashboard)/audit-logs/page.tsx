import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { DataTable } from "@/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";

type AuditRow = {
  id: string;
  action: string;
  tableName: string;
  user: string;
  timestamp: string;
  ipAddress: string;
};

export default async function AuditLogsPage() {
  const t = await getTranslations("audit");

  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { timestamp: "desc" },
    take: 500,
  });

  const rows: AuditRow[] = logs.map((log) => ({
    id: log.id,
    action: log.action,
    tableName: log.tableName,
    user: log.user?.name ?? "System",
    timestamp: log.timestamp.toLocaleString(),
    ipAddress: log.ipAddress ?? "-",
  }));

  const columns: ColumnDef<AuditRow>[] = [
    { accessorKey: "action", header: t("action") },
    { accessorKey: "tableName", header: t("table") },
    { accessorKey: "user", header: t("user") },
    { accessorKey: "timestamp", header: t("timestamp") },
    { accessorKey: "ipAddress", header: t("ip") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <DataTable columns={columns} data={rows} />
    </div>
  );
}
