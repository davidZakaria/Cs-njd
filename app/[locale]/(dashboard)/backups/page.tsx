import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { TriggerBackupButton } from "@/components/backups/trigger-backup-button";
import { BackupContentsPreview } from "@/components/backups/backup-contents-preview";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { isBackupManifest } from "@/lib/backup/backup-manifest";
import { getBackupCronSchedule } from "@/lib/backup/run-full-backup";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const schedule = getBackupCronSchedule();
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

      <Card className="border-[var(--color-chart-1)]/20 bg-gradient-to-br from-[var(--color-chart-1)]/5 to-card shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("autoBackupTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t("autoBackupSchedule", { schedule })}</p>
          <ul className="list-disc space-y-1 ps-5">
            <li>{t("autoBackupPointDatabase")}</li>
            <li>{t("autoBackupPointEnv")}</li>
            <li>{t("autoBackupPointDeploy")}</li>
            <li>{t("autoBackupPointLegacy")}</li>
          </ul>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("filename")}</TableHead>
              <TableHead>{t("source")}</TableHead>
              <TableHead>{t("size")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("createdAt")}</TableHead>
              <TableHead>{t("contents")}</TableHead>
              <TableHead>{t("download")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              backups.map((backup) => {
                const manifest = isBackupManifest(backup.manifest)
                  ? backup.manifest
                  : null;
                const legacySql = backup.filename.endsWith(".sql");

                return (
                  <TableRow key={backup.id} className="align-top">
                    <TableCell className="max-w-[12rem] font-mono text-xs">
                      {backup.filename}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {backup.source === "SCHEDULED"
                          ? t("sourceScheduled")
                          : t("sourceManual")}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatSize(backup.size)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(backup.status)}>
                        {backup.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {backup.createdAt.toLocaleString()}
                    </TableCell>
                    <TableCell className="min-w-[16rem] max-w-md">
                      <BackupContentsPreview
                        manifest={manifest}
                        legacySql={legacySql && !manifest}
                      />
                    </TableCell>
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
