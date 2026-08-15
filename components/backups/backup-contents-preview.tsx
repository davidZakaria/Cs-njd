"use client";

import { useTranslations } from "next-intl";
import type { BackupManifest } from "@/lib/backup/backup-manifest";
import { cn } from "@/lib/utils";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupContentsPreview({
  manifest,
  legacySql,
}: {
  manifest: BackupManifest | null;
  legacySql?: boolean;
}) {
  const t = useTranslations("backups.manifest");

  if (legacySql) {
    return (
      <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
        <li>{t("legacySql")}</li>
      </ul>
    );
  }

  if (!manifest) {
    return (
      <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
    );
  }

  const includedSystem = manifest.systemFiles.filter((file) => file.included);

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="mb-1.5 font-medium text-foreground">{t("databaseSection")}</p>
        <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
          <li>{t("databaseDump", { size: formatSize(manifest.database.sizeBytes) })}</li>
          <li>{t("users", { count: manifest.database.counts.users })}</li>
          <li>{t("units", { count: manifest.database.counts.units })}</li>
          <li>{t("tickets", { count: manifest.database.counts.tickets })}</li>
          <li>{t("clients", { count: manifest.database.counts.clients })}</li>
          <li>{t("projects", { count: manifest.database.counts.projects })}</li>
          <li>{t("auditLogs", { count: manifest.database.counts.auditLogs })}</li>
        </ul>
      </div>

      {includedSystem.length > 0 ? (
        <div>
          <p className="mb-1.5 font-medium text-foreground">{t("systemSection")}</p>
          <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
            {includedSystem.map((file) => (
              <li key={file.path}>
                {t(file.labelKey as Parameters<typeof t>[0])}
                <span className="ms-1 tabular-nums text-xs">
                  ({formatSize(file.sizeBytes)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className={cn("text-xs text-muted-foreground")}>
        {manifest.source === "SCHEDULED" ? t("scheduledNote") : t("manualNote")}
      </p>
    </div>
  );
}
