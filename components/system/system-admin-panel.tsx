"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Database,
  Loader2,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";

import { checkUpdatesAction } from "@/lib/actions/system";
import { clearSystemCache, updateSystemSetting } from "@/lib/actions/settings";
import { SYSTEM_SETTING_KEYS } from "@/lib/system/settings-keys";
import type { SystemAdminSettingKey } from "@/lib/system/settings-helpers";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type SystemAdminSettingsState = Record<SystemAdminSettingKey, string>;

type UpdateCheckResult = {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  message: string;
};

function toBool(value: string): boolean {
  return value === "true";
}

function fromBool(value: boolean): string {
  return value ? "true" : "false";
}

export function SystemAdminPanel({
  initialSettings,
}: {
  initialSettings: SystemAdminSettingsState;
}) {
  const t = useTranslations("system");
  const router = useRouter();
  const { pending, notify, runAction } = useCrudToast();
  const [settings, setSettings] = useState(initialSettings);
  const [savingBackup, setSavingBackup] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(
    null
  );

  const maintenanceEnabled = toBool(settings.MAINTENANCE_MODE);

  function handleMaintenanceToggle(enabled: boolean) {
    const message = enabled
      ? t("maintenance.enableConfirm")
      : t("maintenance.disableConfirm");

    if (!window.confirm(message)) {
      return;
    }

    const value = fromBool(enabled);
    setSettings((current) => ({ ...current, MAINTENANCE_MODE: value }));
    runAction(async () => {
      const result = await updateSystemSetting(
        SYSTEM_SETTING_KEYS.MAINTENANCE_MODE,
        value
      );
      if (result.success) {
        router.refresh();
      }
      return result;
    }, "saved", enabled ? t("maintenance.enabledToast") : t("maintenance.disabledToast"));
  }

  function handleSaveBackupRetention() {
    const days = Number.parseInt(settings.BACKUP_RETENTION_DAYS, 10);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      notify({ success: false, error: t("backup.invalidDays") });
      return;
    }

    const value = String(days);
    setSavingBackup(true);
    runAction(async () => {
      const result = await updateSystemSetting(
        SYSTEM_SETTING_KEYS.BACKUP_RETENTION_DAYS,
        value
      );
      if (result.success) {
        setSettings((current) => ({
          ...current,
          BACKUP_RETENTION_DAYS: value,
        }));
        router.refresh();
      }
      setSavingBackup(false);
      return result;
    });
  }

  async function handleCheckUpdates() {
    setCheckingUpdates(true);
    try {
      const result = await checkUpdatesAction();
      setUpdateResult(result);
    } catch {
      notify({ success: false, error: t("updates.checkFailed") });
    } finally {
      setCheckingUpdates(false);
    }
  }

  function handleClearCache() {
    if (!window.confirm(t("danger.clearCacheConfirm"))) {
      return;
    }

    setClearingCache(true);
    runAction(async () => {
      const result = await clearSystemCache();
      setClearingCache(false);
      return result;
    }, "saved", t("danger.clearCacheSuccess"));
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1 text-start">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid max-w-3xl gap-6">
        <Card className="shadow-premium">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 [dir=rtl]:flex-row-reverse">
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
              <Server className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1 text-start">
              <CardTitle>{t("maintenance.title")}</CardTitle>
              <CardDescription>{t("maintenance.description")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium text-destructive text-start">
              {t("maintenance.warning")}
            </p>

            <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 p-4 [dir=rtl]:flex-row-reverse">
              <div className="space-y-0.5 text-start">
                <Label htmlFor="maintenance-mode" className="text-sm font-medium">
                  {t("maintenance.enableLabel")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {maintenanceEnabled
                    ? t("maintenance.activeHint")
                    : t("maintenance.inactiveHint")}
                </p>
              </div>
              <Switch
                id="maintenance-mode"
                checked={maintenanceEnabled}
                disabled={pending}
                onCheckedChange={handleMaintenanceToggle}
                className={maintenanceEnabled ? "bg-amber-500" : undefined}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-premium">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 [dir=rtl]:flex-row-reverse">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Database className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1 text-start">
              <CardTitle>{t("backup.title")}</CardTitle>
              <CardDescription>{t("backup.description")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-start">
            <Label htmlFor="backup-retention">{t("backup.retentionLabel")}</Label>
            <Input
              id="backup-retention"
              type="number"
              min={1}
              max={365}
              inputMode="numeric"
              value={settings.BACKUP_RETENTION_DAYS}
              onChange={(e) =>
                setSettings((current) => ({
                  ...current,
                  BACKUP_RETENTION_DAYS: e.target.value,
                }))
              }
              disabled={pending || savingBackup}
              className="max-w-[12rem] text-start"
            />
            <p className="text-xs text-muted-foreground">{t("backup.retentionHint")}</p>
          </CardContent>
          <CardFooter className="justify-end border-t bg-muted/10 [dir=rtl]:justify-start">
            <Button
              type="button"
              disabled={pending || savingBackup}
              onClick={handleSaveBackupRetention}
            >
              {savingBackup ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("backup.save")
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-destructive/30 shadow-premium">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 [dir=rtl]:flex-row-reverse">
            <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
              <AlertTriangle className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1 text-start">
              <CardTitle>{t("danger.title")}</CardTitle>
              <CardDescription>{t("danger.description")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-start">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("updates.title")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("updates.description")}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("currentVersion")}: 1.0.0
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={checkingUpdates || pending}
                onClick={() => void handleCheckUpdates()}
              >
                {checkingUpdates ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("updates.checking")}
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-4" />
                    {t("checkUpdates")}
                  </>
                )}
              </Button>
              {updateResult ? (
                <div className="rounded-md border bg-background p-3 text-sm">
                  <p>{updateResult.message}</p>
                  <p className="mt-1 text-muted-foreground">
                    {t("updates.current")}: {updateResult.currentVersion}
                  </p>
                  <p className="text-muted-foreground">
                    {t("updates.latest")}: {updateResult.latestVersion}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-3 text-start">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("danger.clearCacheTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("danger.clearCacheDescription")}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                disabled={clearingCache || pending}
                onClick={handleClearCache}
              >
                {clearingCache ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("danger.clearing")}
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4" />
                    {t("danger.clearCache")}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
