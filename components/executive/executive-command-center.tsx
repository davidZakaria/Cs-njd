"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ExecutiveOverviewPanel } from "@/components/executive/executive-overview-panel";
import { ExecutiveProjectPanel } from "@/components/executive/executive-project-panel";
import { ExecutiveResolvedPanel } from "@/components/executive/executive-resolved-panel";
import type { ExecutiveKpiKey } from "@/components/executive/executive-kpi-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { buildCasesFilterUrl } from "@/lib/cases/cases-filter-url";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ExecutiveDashboardData } from "@/lib/cases/executive-dashboard";

function TabCountBadge({
  count,
  variant = "open",
}: {
  count: number;
  variant?: "open" | "resolved";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
        variant === "open"
          ? "bg-muted/80 text-muted-foreground group-data-active/tabs-trigger:bg-[var(--color-chart-1)]/15 group-data-active/tabs-trigger:text-[var(--color-chart-1)]"
          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 group-data-active/tabs-trigger:bg-emerald-500/15"
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
    (): Record<ExecutiveKpiKey, string> => ({
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
                <Link
                  href={buildCasesFilterUrl({ status: "open" })}
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex"
                  title={t("viewAllCases")}
                >
                  <TabCountBadge count={data.global.stats.openTotal} />
                </Link>
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="resolved"
              className={cn(
                "group/tabs-trigger snap-start rounded-md px-4 py-2.5 text-sm font-medium",
                "text-muted-foreground transition-colors",
                "hover:bg-muted/60 hover:text-foreground",
                "data-active:bg-background data-active:text-foreground data-active:shadow-sm",
                "data-active:ring-1 data-active:ring-foreground/10"
              )}
            >
              <span className="flex items-center gap-2">
                {t("resolved")}
                <TabCountBadge count={data.resolved.stats.resolvedTotal} />
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
                  <Link
                    href={buildCasesFilterUrl({
                      status: "open",
                      project: slice.slug,
                    })}
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex"
                    title={t("viewProjectCases")}
                  >
                    <TabCountBadge count={slice.stats.openTotal} variant="open" />
                  </Link>
                  {slice.resolvedStats.resolvedTotal > 0 ? (
                    <Link
                      href={buildCasesFilterUrl({
                        status: "RESOLVED",
                        project: slice.slug,
                      })}
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex"
                      title={t("viewProjectResolved")}
                    >
                      <TabCountBadge
                        count={slice.resolvedStats.resolvedTotal}
                        variant="resolved"
                      />
                    </Link>
                  ) : null}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      <TabsContent value="overview" className="animate-in fade-in-50">
        <ExecutiveOverviewPanel
          data={data}
          kpiLabels={kpiLabels}
          workloadLabels={workloadLabels}
        />
      </TabsContent>

      <TabsContent value="resolved" className="animate-in fade-in-50">
        <ExecutiveResolvedPanel data={data} />
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
