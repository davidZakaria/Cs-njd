import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { TriggerBackupButton } from "@/components/backups/trigger-backup-button";
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

export default async function BackupsPage() {
  const t = await getTranslations("backups");
  const backups = await prisma.backupLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
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
            {backups.map((backup) => (
              <TableRow key={backup.id}>
                <TableCell>{backup.filename}</TableCell>
                <TableCell>{formatSize(backup.size)}</TableCell>
                <TableCell>{backup.status}</TableCell>
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
                    "-"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
