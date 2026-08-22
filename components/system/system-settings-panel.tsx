"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Construction } from "lucide-react";

import { setMaintenanceModeAction } from "@/lib/actions/system-settings";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MaintenanceModeToggle({
  enabled: initialEnabled,
}: {
  enabled: boolean;
}) {
  const t = useTranslations("systemSettings");
  const router = useRouter();
  const { pending, notify } = useCrudToast();
  const [enabled, setEnabled] = useState(initialEnabled);

  async function applyToggle(nextEnabled: boolean) {
    const result = await setMaintenanceModeAction(nextEnabled);
    if (!result.success) {
      notify(result);
      return;
    }

    setEnabled(nextEnabled);
    notify(
      result,
      "saved",
      nextEnabled ? t("maintenanceEnabledToast") : t("maintenanceDisabledToast")
    );
    router.refresh();
  }

  function handleToggle(nextEnabled: boolean) {
    const message = nextEnabled
      ? t("maintenanceEnableConfirm")
      : t("maintenanceDisableConfirm");

    if (!window.confirm(message)) {
      return;
    }

    void applyToggle(nextEnabled);
  }

  return (
    <Card className="shadow-premium max-w-2xl">
      <CardHeader>
        <CardTitle>{t("maintenanceTitle")}</CardTitle>
        <CardDescription>{t("maintenanceDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {enabled ? t("maintenanceActive") : t("maintenanceInactive")}
          </p>
          <p className="text-sm text-muted-foreground">{t("maintenanceHint")}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={t("maintenanceTitle")}
            disabled={pending}
            onClick={() => handleToggle(!enabled)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              enabled ? "bg-amber-500" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "pointer-events-none block size-5 rounded-full bg-background shadow-sm transition-transform duration-300",
                enabled
                  ? "translate-x-5 rtl:-translate-x-5"
                  : "translate-x-0.5 rtl:-translate-x-0.5"
              )}
            />
          </button>
          <span className="text-sm text-muted-foreground">
            {enabled ? t("maintenanceOn") : t("maintenanceOff")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemSettingsPanel({
  maintenanceEnabled,
}: {
  maintenanceEnabled: boolean;
}) {
  const t = useTranslations("systemSettings");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <MaintenanceModeToggle enabled={maintenanceEnabled} />

      <Card className="max-w-2xl border-dashed">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
            <Construction className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base">{t("maintenanceBypassTitle")}</CardTitle>
            <CardDescription>{t("maintenanceBypassDescription")}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
