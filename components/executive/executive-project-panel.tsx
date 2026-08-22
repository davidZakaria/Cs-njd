"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { ExecutiveCaseSearchBar } from "@/components/executive/executive-case-search-bar";
import { ExecutiveQuickActionsTable } from "@/components/executive/executive-quick-actions-table";
import {
  buildExecutiveKpiItems,
  ExecutiveKpiGrid,
} from "@/components/executive/executive-kpi-grid";
import { ExecutiveAgentWorkloadGrid } from "@/components/executive/executive-agent-workload-grid";
import { ExecutiveQueueSection } from "@/components/executive/executive-queue-section";
import { StatusDonutChart } from "@/components/executive/status-donut-chart";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { buildCasesFilterUrl } from "@/lib/cases/cases-filter-url";
import { filterExecutiveCaseRows } from "@/lib/executive/filter-case-rows";
import type {
  ExecutiveDashboardData,
  ProjectDashboardSlice,
} from "@/lib/cases/executive-dashboard";
import type { ExecutiveKpiKey } from "@/components/executive/executive-kpi-grid";

type WorkloadLabels = {
  openTotal: string;
  pending: string;
  legal: string;
  engineering: string;
};

export function ExecutiveProjectPanel({
  slice,
  agents,
  kpiLabels,
  workloadLabels,
}: {
  slice: ProjectDashboardSlice;
  agents: ExecutiveDashboardData["agents"];
  kpiLabels: Record<ExecutiveKpiKey, string>;
  workloadLabels: WorkloadLabels;
}) {
  const t = useTranslations("executive");
  const tCases = useTranslations("cases");
  const labels = useDomainLabels();
  const [query, setQuery] = useState("");

  const projectKpis = useMemo(
    () =>
      buildExecutiveKpiItems(slice.stats, kpiLabels, {
        openTotal: buildCasesFilterUrl({
          status: "open",
          project: slice.slug,
        }),
        unassigned: buildCasesFilterUrl({
          status: "open",
          project: slice.slug,
          agent: "unassigned",
        }),
        legal: buildCasesFilterUrl({ status: "LEGAL", project: slice.slug }),
        engineering: buildCasesFilterUrl({
          status: "ENGINEERING",
          project: slice.slug,
        }),
        myOpen: buildCasesFilterUrl({ status: "open", project: slice.slug }),
        teamOpen: buildCasesFilterUrl({ status: "open", project: slice.slug }),
      }),
    [slice.stats, slice.slug, kpiLabels]
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
    () => filterExecutiveCaseRows(slice.teamQueue, query, searchContext),
    [slice.teamQueue, query, searchContext]
  );

  const filteredMyQueue = useMemo(
    () => filterExecutiveCaseRows(slice.myQueue, query, searchContext),
    [slice.myQueue, query, searchContext]
  );

  const hasCases = slice.stats.openTotal > 0;
  const isSearching = query.trim().length > 0;
  const totalMatches = filteredTeamQueue.length + filteredMyQueue.length;
  const totalCases = slice.teamQueue.length + slice.myQueue.length;

  if (!hasCases) {
    return (
      <p className="rounded-xl border border-dashed bg-muted/20 py-12 text-center text-sm text-muted-foreground">
        {t("noProjectCases")}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <ExecutiveKpiGrid items={projectKpis} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
        <StatusDonutChart
          breakdown={slice.categoryBreakdown}
          title={t("casesByCategory")}
          className="shadow-sm"
          statusScope="open"
          projectSlug={slice.slug}
        />
        <ExecutiveAgentWorkloadGrid
          agents={slice.agentWorkload}
          title={t("projectWorkload")}
          labels={workloadLabels}
        />
      </div>

      <ExecutiveCaseSearchBar
        query={query}
        onQueryChange={setQuery}
        title={t("searchTitle")}
        subtitle={t("searchSubtitleProject")}
        placeholder={t("searchPlaceholder")}
        totalMatches={totalMatches}
        totalCases={totalCases}
        teamMatches={filteredTeamQueue.length}
        myMatches={filteredMyQueue.length}
        teamLabel={t("stats.teamOpen")}
        myLabel={t("stats.myOpen")}
      />

      <ExecutiveQueueSection
        title={t("teamQueueTitle")}
        subtitle={t("teamQueueSubtitle")}
      >
        <ExecutiveQuickActionsTable
          rows={filteredTeamQueue}
          agents={agents}
          canAssign={true}
          emptyLabel={isSearching ? t("searchNoResults") : t("teamQueueEmpty")}
        />
      </ExecutiveQueueSection>

      <ExecutiveQueueSection
        title={t("myQueueTitle")}
        subtitle={t("myQueueSubtitle")}
      >
        <ExecutiveQuickActionsTable
          rows={filteredMyQueue}
          agents={agents}
          canAssign={false}
          emptyLabel={isSearching ? t("searchNoResults") : t("myQueueEmpty")}
        />
      </ExecutiveQueueSection>
    </div>
  );
}
