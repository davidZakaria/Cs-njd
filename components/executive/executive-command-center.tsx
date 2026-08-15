"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ExecutiveProjectPanel } from "@/components/executive/executive-project-panel";
import {
  buildExecutiveKpiItems,
  ExecutiveKpiGrid,
} from "@/components/executive/executive-kpi-grid";
import { ExecutiveAgentWorkloadGrid } from "@/components/executive/executive-agent-workload-grid";
import { ProjectDistributionChart } from "@/components/executive/project-distribution-chart";
import { StatusDonutChart } from "@/components/executive/status-donut-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { cn } from "@/lib/utils";
import type { ExecutiveDashboardData } from "@/lib/cases/executive-dashboard";

function TabCountBadge({ count }: { count: number }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
        "bg-muted/80 text-muted-foreground group-data-active/tabs-trigger:bg-[var(--color-chart-1)]/15 group-data-active/tabs-trigger:text-[var(--color-chart-1)]"
      )}
    >
      {count}
    </span>
  );
}

export function ExecutiveCommandCenter({
  data,
}: {
  data: ExecutiveDashboardData;
}) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const t = useTranslations("executive");
  const { project: projectLabel } = useDomainLabels();

  const kpiLabels = useMemo(
    () => ({
      openTotal: t("stats.openTotal"),
      unassigned: t("stats.unassigned"),
      legal: t("stats.legal"),
      engineering: t("stats.engineering"),
      myOpen: t("stats.myOpen"),
      teamOpen: t("stats.teamOpen"),
    }),
    [t]
  );

  const workloadLabels = useMemo(
    () => ({
      openTotal: t("stats.openTotal"),
      pending: t("stats.pending"),
      legal: t("stats.legal"),
      engineering: t("stats.engineering"),
    }),
    [t]
  );

  const overviewKpis = useMemo(
    () => buildExecutiveKpiItems(data.global.stats, kpiLabels),
    [data.global.stats, kpiLabels]
  );

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <div
        className={cn(
          "rounded-xl border bg-gradient-to-b from-muted/40 to-card p-1 shadow-sm",
          "ring-1 ring-foreground/5"
        )}
      >
        <div
          className={cn(
            "overflow-x-auto overscroll-x-contain scroll-smooth pb-0.5",
            isRtl ? "[mask-image:linear-gradient(to_left,transparent,black_12px,black_calc(100%-24px),transparent)]" : "[mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-24px),transparent)]"
          )}
        >
          <TabsList
            variant="line"
            className="h-auto w-max min-w-full justify-start gap-0.5 rounded-lg bg-transparent p-1"
          >
            <TabsTrigger
              value="overview"
              className={cn(
                "group/tabs-trigger snap-start rounded-md px-4 py-2.5 text-sm font-medium",
                "text-muted-foreground transition-colors",
                "hover:bg-muted/60 hover:text-foreground",
                "data-active:bg-background data-active:text-foreground data-active:shadow-sm",
                "data-active:ring-1 data-active:ring-foreground/10"
              )}
            >
              <span className="flex items-center gap-2">
                {t("overview")}
                <TabCountBadge count={data.global.stats.openTotal} />
              </span>
            </TabsTrigger>
            {data.byProject.map((slice) => (
              <TabsTrigger
                key={slice.slug}
                value={slice.slug}
                className={cn(
                  "group/tabs-trigger snap-start rounded-md px-4 py-2.5 text-sm font-medium",
                  "text-muted-foreground transition-colors",
                  "hover:bg-muted/60 hover:text-foreground",
                  "data-active:bg-background data-active:text-foreground data-active:shadow-sm",
                  "data-active:ring-1 data-active:ring-foreground/10"
                )}
              >
                <span className="flex max-w-[11rem] items-center gap-2 sm:max-w-none">
                  <span className="truncate">{projectLabel(slice.project)}</span>
                  <TabCountBadge count={slice.stats.openTotal} />
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      <TabsContent value="overview" className="space-y-8 animate-in fade-in-50">
        <ExecutiveKpiGrid items={overviewKpis} />

        <div className="grid gap-6 xl:grid-cols-2">
          <ProjectDistributionChart
            data={data.global.projectsOpenCounts}
            className="shadow-sm"
          />
          <StatusDonutChart
            breakdown={data.global.categoryBreakdown}
            className="shadow-sm"
          />
        </div>

        <ExecutiveAgentWorkloadGrid
          agents={data.global.agentWorkload}
          title={t("agentWorkload")}
          labels={workloadLabels}
        />
      </TabsContent>

      {data.byProject.map((slice) => (
          <TabsContent
            key={slice.slug}
            value={slice.slug}
            className="animate-in fade-in-50"
          >
            <ExecutiveProjectPanel
              slice={slice}
              agents={data.agents}
              kpiLabels={kpiLabels}
              workloadLabels={workloadLabels}
            />
          </TabsContent>
        ))}
    </Tabs>
  );
}
