"use client";

import {
  Activity,
  Clock3,
  Cpu,
  Database,
  HardDrive,
  Server,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  formatBytes,
  formatPercent,
  formatUptime,
  getHeapTone,
  getLoadTone,
  getDiskTone,
  getUsageTone,
  USAGE_TONE_BAR_CLASS,
  USAGE_TONE_RING_CLASS,
  USAGE_TONE_TEXT_CLASS,
} from "@/lib/system/health-format";
import type { MonitoringMetrics } from "@/lib/system/health-metrics";
import { cn } from "@/lib/utils";

function MetricCard({
  title,
  icon: Icon,
  value,
  subtitle,
  percent,
  tone,
  hint,
  details,
}: {
  title: string;
  icon: typeof Activity;
  value: string;
  subtitle: string;
  percent?: number;
  tone?: ReturnType<typeof getUsageTone>;
  hint?: string;
  details?: string[];
}) {
  const resolvedTone = tone ?? (percent != null ? getUsageTone(percent) : "healthy");

  return (
    <Card
      className={cn(
        "shadow-premium ring-1 ring-inset transition-colors",
        USAGE_TONE_RING_CLASS[resolvedTone]
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2 text-start">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums tracking-tight",
              percent != null && USAGE_TONE_TEXT_CLASS[resolvedTone]
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          {details?.map((line) => (
            <p key={line} className="mt-1 text-xs text-muted-foreground">
              {line}
            </p>
          ))}
          {hint ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground/90">
              {hint}
            </p>
          ) : null}
        </div>
        {percent != null ? (
          <Progress
            value={percent}
            indicatorClassName={USAGE_TONE_BAR_CLASS[resolvedTone]}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SystemHealthPanel({ metrics }: { metrics: MonitoringMetrics }) {
  const t = useTranslations("systemMonitoring");
  const locale = useLocale();

  const ramTone = getUsageTone(metrics.memory.usedPercent);
  const heapTone = getHeapTone(
    metrics.processMemory.heapUsedPercent,
    metrics.processMemory.heapUsedBytes
  );
  const load1Tone = getLoadTone(
    metrics.loadAverage.oneMinute,
    metrics.cpuCount
  );
  const diskTone = getDiskTone(metrics.disk.usedPercent);

  return (
    <div className="space-y-6">
      <Card className="border-dashed bg-muted/20 shadow-none">
        <CardContent className="flex flex-wrap gap-4 py-4 text-sm">
          <div className="flex items-center gap-2">
            <Server className="size-4 text-muted-foreground" />
            <span>
              <strong>{t("hostname")}:</strong> {metrics.hostname}
            </span>
          </div>
          <div>
            <strong>{t("platform")}:</strong> {metrics.platform}
          </div>
          <div>
            <strong>{t("cpuCores")}:</strong> {metrics.cpuCount}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title={t("serverMemory")}
          icon={HardDrive}
          value={formatPercent(metrics.memory.usedPercent)}
          subtitle={t("memoryUsageDetail", {
            used: formatBytes(metrics.memory.usedBytes),
            total: formatBytes(metrics.memory.totalBytes),
          })}
          percent={metrics.memory.usedPercent}
          tone={ramTone}
        />
        <MetricCard
          title={t("nodeHeap")}
          icon={Activity}
          value={formatPercent(metrics.processMemory.heapUsedPercent)}
          subtitle={t("heapUsageDetail", {
            used: formatBytes(metrics.processMemory.heapUsedBytes),
            total: formatBytes(metrics.processMemory.heapTotalBytes),
          })}
          percent={metrics.processMemory.heapUsedPercent}
          tone={heapTone}
          hint={t("heapHint")}
        />
        <MetricCard
          title={t("processRss")}
          icon={Server}
          value={formatBytes(metrics.processMemory.rssBytes)}
          subtitle={t("rssDetail", {
            external: formatBytes(metrics.processMemory.externalBytes),
          })}
        />
        <MetricCard
          title={t("serverUptime")}
          icon={Clock3}
          value={formatUptime(metrics.uptimeSeconds, locale)}
          subtitle={t("uptimeDetail", {
            seconds: Math.floor(metrics.uptimeSeconds).toLocaleString(locale),
          })}
        />
        <MetricCard
          title={t("load1m")}
          icon={Cpu}
          value={metrics.loadAverage.oneMinute.toFixed(2)}
          subtitle={t("loadDetail", {
            cores: metrics.cpuCount,
            percent: formatPercent(
              metrics.cpuCount > 0
                ? (metrics.loadAverage.oneMinute / metrics.cpuCount) * 100
                : 0
            ),
          })}
          percent={
            metrics.cpuCount > 0
              ? (metrics.loadAverage.oneMinute / metrics.cpuCount) * 100
              : 0
          }
          tone={load1Tone}
        />
        <MetricCard
          title={t("load5m15m")}
          icon={Cpu}
          value={`${metrics.loadAverage.fiveMinutes.toFixed(2)} / ${metrics.loadAverage.fifteenMinutes.toFixed(2)}`}
          subtitle={t("loadAverageHint")}
        />
        <MetricCard
          title={t("serverDiskStorage")}
          icon={HardDrive}
          value={formatPercent(metrics.disk.usedPercent)}
          subtitle={t("diskUsageDetail", {
            used: formatBytes(metrics.disk.usedBytes),
            total: formatBytes(metrics.disk.totalBytes),
          })}
          percent={metrics.disk.usedPercent}
          tone={diskTone}
          hint={
            metrics.disk.source === "mock" ? t("diskMockHint") : undefined
          }
        />
        <MetricCard
          title={t("databaseHealth")}
          icon={Database}
          value={metrics.database.sizePretty}
          subtitle={t("databaseSizeLabel")}
          details={[
            t("activeConnectionsDetail", {
              count: metrics.database.activeConnections.toLocaleString(locale),
            }),
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("legendTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-emerald-500" />
            {t("legendHealthy")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-amber-500" />
            {t("legendWarning")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-500" />
            {t("legendCritical")}
          </span>
          <p className="w-full text-xs leading-relaxed">{t("legendHeapNote")}</p>
          <p className="w-full text-xs leading-relaxed">{t("legendDiskNote")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
