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
import { ProjectDistributionChart } from "@/components/executive/project-distribution-chart";
import { StatusDonutChart } from "@/components/executive/status-donut-chart";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { filterExecutiveCaseRows } from "@/lib/executive/filter-case-rows";
import type { ExecutiveDashboardData } from "@/lib/cases/executive-dashboard";
import type { ExecutiveKpiKey } from "@/components/executive/executive-kpi-grid";

type WorkloadLabels = {
  openTotal: string;
  pending: string;
  legal: string;
  engineering: string;
};

export function ExecutiveOverviewPanel({
  data,
  kpiLabels,
  workloadLabels,
}: {
  data: ExecutiveDashboardData;
  kpiLabels: Record<ExecutiveKpiKey, string>;
  workloadLabels: WorkloadLabels;
}) {
  const t = useTranslations("executive");
  const tCases = useTranslations("cases");
  const labels = useDomainLabels();
  const [query, setQuery] = useState("");

  const overviewKpis = useMemo(
    () => buildExecutiveKpiItems(data.global.stats, kpiLabels),
    [data.global.stats, kpiLabels]
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
    () => filterExecutiveCaseRows(data.teamQueue, query, searchContext),
    [data.teamQueue, query, searchContext]
  );

  const filteredMyQueue = useMemo(
    () => filterExecutiveCaseRows(data.myQueue, query, searchContext),
    [data.myQueue, query, searchContext]
  );

  const isSearching = query.trim().length > 0;
  const totalMatches = filteredTeamQueue.length + filteredMyQueue.length;
  const totalCases = data.teamQueue.length + data.myQueue.length;
  const hasCases = data.global.stats.openTotal > 0;

  return (
    <div className="space-y-8">
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

      {hasCases ? (
        <>
          <ExecutiveCaseSearchBar
            query={query}
            onQueryChange={setQuery}
            title={t("searchTitle")}
            subtitle={t("searchSubtitleOverview")}
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
              agents={data.agents}
              canAssign={true}
              emptyLabel={
                isSearching ? t("searchNoResults") : t("teamQueueEmpty")
              }
            />
          </ExecutiveQueueSection>

          <ExecutiveQueueSection
            title={t("myQueueTitle")}
            subtitle={t("myQueueSubtitle")}
          >
            <ExecutiveQuickActionsTable
              rows={filteredMyQueue}
              agents={data.agents}
              canAssign={false}
              emptyLabel={
                isSearching ? t("searchNoResults") : t("myQueueEmpty")
              }
            />
          </ExecutiveQueueSection>
        </>
      ) : null}
    </div>
  );
}
