import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { TriggerBackupButton } from "@/components/backups/trigger-backup-button";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusVariant(status: string) {
  if (status === "SUCCESS") return "secondary" as const;
  if (status === "FAILED") return "destructive" as const;
  return "outline" as const;
}

export default async function BackupsPage() {
  await requireSuperAdmin();
  const t = await getTranslations("backups");
  const backups = await prisma.backupLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <TriggerBackupButton />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("filename")}</TableHead>
              <TableHead>{t("size")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("createdAt")}</TableHead>
              <TableHead>{t("download")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              backups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell className="font-mono text-xs">
                    {backup.filename}
                  </TableCell>
                  <TableCell>{formatSize(backup.size)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(backup.status)}>
                      {backup.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{backup.createdAt.toLocaleString()}</TableCell>
                  <TableCell>
                    {backup.status === "SUCCESS" ? (
                      <Link
                        href={`/api/backups/${backup.id}`}
                        className="text-primary hover:underline"
                      >
                        {t("download")}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
