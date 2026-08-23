"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { fetchMonitoringMetrics } from "@/lib/actions/monitoring";
import { SystemHealthPanel } from "@/components/system/system-health-panel";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MonitoringMetrics } from "@/lib/system/health-metrics";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 5000;

export function LiveMonitoringDashboard({
  initialData,
}: {
  initialData: MonitoringMetrics;
}) {
  const t = useTranslations("systemMonitoring");
  const locale = useLocale();
  const [metrics, setMetrics] = useState(initialData);
  const [liveRefresh, setLiveRefresh] = useState(true);

  const refreshMetrics = useCallback(async () => {
    const result = await fetchMonitoringMetrics();
    if (result.success) {
      setMetrics(result.data);
    }
  }, []);

  useEffect(() => {
    if (!liveRefresh) return;

    const intervalId = window.setInterval(refreshMetrics, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [liveRefresh, refreshMetrics]);

  const capturedAt = new Date(metrics.capturedAt).toLocaleString(locale);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-4">
          <div className="text-start">
            <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="live-auto-refresh"
              checked={liveRefresh}
              onCheckedChange={setLiveRefresh}
              aria-label={t("liveAutoRefresh")}
            />
            <Label
              className="cursor-pointer font-normal text-muted-foreground"
              onClick={() => setLiveRefresh((value) => !value)}
            >
              {t("liveAutoRefresh")}
            </Label>
          </div>
        </div>
        <p
          className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground",
            locale === "ar" ? "flex-row-reverse" : "flex-row"
          )}
        >
          {liveRefresh ? (
            <span className="relative flex size-2 shrink-0" aria-hidden>
              <span className="absolute inline-flex size-full animate-pulse rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
          ) : null}
          <span>
            {t("lastUpdated")}: {capturedAt}
          </span>
        </p>
      </div>

      <SystemHealthPanel metrics={metrics} />
    </div>
  );
}
