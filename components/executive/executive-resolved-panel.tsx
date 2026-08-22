"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

import { ExecutiveCaseSearchBar } from "@/components/executive/executive-case-search-bar";
import { ExecutiveQuickActionsTable } from "@/components/executive/executive-quick-actions-table";
import { ExecutiveKpiGrid, type StatItem } from "@/components/executive/executive-kpi-grid";
import { ExecutiveQueueSection } from "@/components/executive/executive-queue-section";
import { ProjectDistributionChart } from "@/components/executive/project-distribution-chart";
import { StatusDonutChart } from "@/components/executive/status-donut-chart";
import { buttonVariants } from "@/components/ui/button";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { buildCasesFilterUrl } from "@/lib/cases/cases-filter-url";
import type { ExecutiveDashboardData } from "@/lib/cases/executive-dashboard";
import { filterExecutiveCaseRows } from "@/lib/executive/filter-case-rows";
import { cn } from "@/lib/utils";

export function ExecutiveResolvedPanel({
  data,
}: {
  data: ExecutiveDashboardData;
}) {
  const t = useTranslations("executive");
  const tCases = useTranslations("cases");
  const labels = useDomainLabels();
  const [query, setQuery] = useState("");

  const resolvedKpis = useMemo(
    (): StatItem[] => [
      {
        key: "resolvedTotal",
        label: t("stats.resolvedTotal"),
        value: data.resolved.stats.resolvedTotal,
        href: buildCasesFilterUrl({ status: "RESOLVED" }),
      },
      {
        key: "myResolved",
        label: t("stats.myResolved"),
        value: data.resolved.stats.myResolved,
        href: buildCasesFilterUrl({ status: "RESOLVED" }),
      },
      {
        key: "teamResolved",
        label: t("stats.teamResolved"),
        value: data.resolved.stats.teamResolved,
        href: buildCasesFilterUrl({ status: "RESOLVED" }),
      },
    ],
    [data.resolved.stats, t]
  );

  const searchContext = useMemo(
    () => ({
      projectLabel: labels.project,
      ticketStatus: labels.ticketStatus,
      ticketCategory: labels.ticketCategory,
      staffName: labels.staffName,
      awaitingResponseLabel: tCases("awaitingResponse"),
    }),
    [labels, tCases]
  );

  const filteredTeamQueue = useMemo(
    () => filterExecutiveCaseRows(data.resolved.teamQueue, query, searchContext),
    [data.resolved.teamQueue, query, searchContext]
  );

  const filteredMyQueue = useMemo(
    () => filterExecutiveCaseRows(data.resolved.myQueue, query, searchContext),
    [data.resolved.myQueue, query, searchContext]
  );

  const isSearching = query.trim().length > 0;
  const totalMatches = filteredTeamQueue.length + filteredMyQueue.length;
  const totalCases = data.resolved.teamQueue.length + data.resolved.myQueue.length;
  const hasCases = data.resolved.stats.resolvedTotal > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <ExecutiveKpiGrid items={resolvedKpis} />
        </div>
        <Link
          href={buildCasesFilterUrl({ status: "RESOLVED" })}
          className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
        >
          {t("viewAllResolved")}
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProjectDistributionChart
          data={data.resolved.projectsResolvedCounts}
          title={t("resolvedByProject")}
          statusScope="RESOLVED"
          className="shadow-sm"
        />
        <StatusDonutChart
          breakdown={data.resolved.categoryBreakdown}
          title={t("resolvedByCategory")}
          statusScope="RESOLVED"
          className="shadow-sm"
        />
      </div>

      {hasCases ? (
        <>
          <ExecutiveCaseSearchBar
            query={query}
            onQueryChange={setQuery}
            title={t("resolvedSearchTitle")}
            subtitle={t("resolvedSearchSubtitle")}
            placeholder={t("searchPlaceholder")}
            totalMatches={totalMatches}
            totalCases={totalCases}
            teamMatches={filteredTeamQueue.length}
            myMatches={filteredMyQueue.length}
            teamLabel={t("stats.teamResolved")}
            myLabel={t("stats.myResolved")}
          />

          <ExecutiveQueueSection
            title={t("resolvedTeamQueueTitle")}
            subtitle={t("resolvedTeamQueueSubtitle")}
          >
            <ExecutiveQuickActionsTable
              rows={filteredTeamQueue}
              agents={data.agents}
              canAssign={false}
              emptyLabel={
                isSearching ? t("searchNoResults") : t("resolvedTeamQueueEmpty")
              }
            />
          </ExecutiveQueueSection>

          <ExecutiveQueueSection
            title={t("resolvedMyQueueTitle")}
            subtitle={t("resolvedMyQueueSubtitle")}
          >
            <ExecutiveQuickActionsTable
              rows={filteredMyQueue}
              agents={data.agents}
              canAssign={false}
              emptyLabel={
                isSearching ? t("searchNoResults") : t("resolvedMyQueueEmpty")
              }
            />
          </ExecutiveQueueSection>
        </>
      ) : (
        <p className="rounded-xl border border-dashed bg-muted/20 py-12 text-center text-sm text-muted-foreground">
          {t("noResolvedCases")}
        </p>
      )}
    </div>
  );
}
