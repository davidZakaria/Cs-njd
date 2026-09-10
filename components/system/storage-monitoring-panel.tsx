"use client";

import { Cloud, HardDrive, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";

import { updateSystemSetting } from "@/lib/actions/settings";
import type { MonitoringMetrics } from "@/lib/system/health-metrics";
import {
  formatBytes,
  USAGE_TONE_RING_CLASS,
  USAGE_TONE_TEXT_CLASS,
} from "@/lib/system/health-format";
import { SYSTEM_SETTING_KEYS } from "@/lib/system/settings-keys";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function StorageMonitoringPanel({
  metrics,
  initialDriver,
  initialRemoteEnabled,
}: {
  metrics: MonitoringMetrics;
  initialDriver: "local" | "s3";
  initialRemoteEnabled: boolean;
}) {
  const t = useTranslations("systemMonitoring");
  const locale = useLocale();
  const router = useRouter();
  const { pending, runAction } = useCrudToast();
  const [driver, setDriver] = useState<"local" | "s3">(initialDriver);
  const [remoteEnabled, setRemoteEnabled] = useState(initialRemoteEnabled);

  const storage = metrics.objectStorage;
  const backups = metrics.backups;

  function saveDriver(value: "local" | "s3") {
    setDriver(value);
    runAction(async () => {
      const result = await updateSystemSetting(
        SYSTEM_SETTING_KEYS.OBJECT_STORAGE_DRIVER,
        value
      );
      if (result.success) router.refresh();
      return result;
    }, "saved");
  }

  function saveRemoteEnabled(enabled: boolean) {
    setRemoteEnabled(enabled);
    runAction(async () => {
      const result = await updateSystemSetting(
        SYSTEM_SETTING_KEYS.BACKUP_REMOTE_ENABLED,
        enabled ? "true" : "false"
      );
      if (result.success) router.refresh();
      return result;
    }, "saved");
  }

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          "ring-1 ring-inset",
          USAGE_TONE_RING_CLASS[backups.warningTone]
        )}
      >
        <CardHeader>
          <CardTitle className="text-base">{t("backupHealthTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">{t("backupLocalSize")}</p>
              <p className="font-semibold tabular-nums">
                {formatBytes(backups.directoryBytes)} · {backups.archiveCount}{" "}
                {t("backupArchiveCountLabel")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("backupLastSuccess")}</p>
              <p className="font-semibold">
                {backups.lastSuccessAt
                  ? new Date(backups.lastSuccessAt).toLocaleString(locale)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("backupLargestArchive")}</p>
              <p className="font-semibold tabular-nums">
                {formatBytes(backups.largestArchiveBytes)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("backupRemoteStatus")}</p>
              <p
                className={cn(
                  "font-semibold capitalize",
                  backups.lastRemoteStatus === "FAILED"
                    ? USAGE_TONE_TEXT_CLASS.critical
                    : backups.lastRemoteStatus === "SUCCESS"
                      ? USAGE_TONE_TEXT_CLASS.healthy
                      : undefined
                )}
              >
                {t(`backupRemoteStatus_${backups.lastRemoteStatus}`)}
              </p>
            </div>
          </div>

          {backups.warningCodes.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              {backups.warningCodes.map((code) => (
                <li key={code}>• {t(`backupWarnings.${code}`)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{t("backupHealthOk")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="size-4" />
            {t("objectStorageTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={storage.driver === "s3" ? "default" : "secondary"}>
              {storage.driver === "s3" ? t("driverS3") : t("driverLocal")}
            </Badge>
            {storage.driverFallback ? (
              <Badge variant="destructive">{t("driverFallbackBadge")}</Badge>
            ) : null}
            {!storage.s3Configured ? (
              <Badge variant="outline">{t("s3NotConfigured")}</Badge>
            ) : null}
          </div>

          {storage.s3Configured ? (
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <p>
                <strong>{t("s3Bucket")}:</strong> {storage.bucketMasked}
              </p>
              <p className="truncate">
                <strong>{t("s3Endpoint")}:</strong> {storage.endpoint}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("s3SetupHint")}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("objectStorageDriverLabel")}</Label>
              <Select
                value={driver}
                onValueChange={(value) => saveDriver(value as "local" | "s3")}
                disabled={pending || !storage.s3Configured}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">
                    <span className="inline-flex items-center gap-2">
                      <HardDrive className="size-3.5" />
                      {t("driverLocal")}
                    </span>
                  </SelectItem>
                  <SelectItem value="s3">
                    <span className="inline-flex items-center gap-2">
                      <Cloud className="size-3.5" />
                      {t("driverS3")}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <Label htmlFor="remote-backup-toggle" className="font-normal">
                {t("remoteBackupToggle")}
              </Label>
              <Switch
                id="remote-backup-toggle"
                checked={remoteEnabled}
                disabled={pending || !storage.s3Configured}
                onCheckedChange={saveRemoteEnabled}
              />
            </div>
          </div>

          {pending ? (
            <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {t("savingStorageSettings")}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
