"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { ExecutiveCaseSearchBar } from "@/components/executive/executive-case-search-bar";
import { ExecutiveQuickActionsTable } from "@/components/executive/executive-quick-actions-table";
import {
  ExecutiveKpiGrid,
  type StatItem,
} from "@/components/executive/executive-kpi-grid";
import { ExecutiveAgentWorkloadGrid } from "@/components/executive/executive-agent-workload-grid";
import { ExecutiveQueueSection } from "@/components/executive/executive-queue-section";
import { HandoverPipelineChart } from "@/components/executive/handover-pipeline-chart";
import { FinishingPipelineChart } from "@/components/executive/finishing-pipeline-chart";
import { SignedProtocolChart } from "@/components/executive/signed-protocol-chart";
import { PendingPartiesChart } from "@/components/executive/pending-parties-chart";
import { ProjectDistributionChart } from "@/components/executive/project-distribution-chart";
import { StatusDonutChart } from "@/components/executive/status-donut-chart";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { buildCasesFilterUrl } from "@/lib/cases/cases-filter-url";
import { filterExecutiveCaseRows } from "@/lib/executive/filter-case-rows";
import { ExecutiveFinancialsPanel } from "@/components/executive/executive-financials-panel";
import type { ExecutiveDashboardData } from "@/lib/cases/executive-dashboard";
import type { ExecutivePortfolioMetrics } from "@/lib/executive/portfolio-analytics";
import type { ExecutiveFinancials } from "@/lib/executive/financial-analytics";
import type { ExecutiveKpiKey } from "@/components/executive/executive-kpi-grid";

type WorkloadLabels = {
  openTotal: string;
  pending: string;
  legal: string;
  engineering: string;
};

export function ExecutiveOverviewPanel({
  data,
  portfolio,
  financials,
  kpiLabels,
  workloadLabels,
  canUseManagementOverride = false,
}: {
  data: ExecutiveDashboardData;
  portfolio: ExecutivePortfolioMetrics;
  financials: ExecutiveFinancials | null;
  kpiLabels: Record<ExecutiveKpiKey, string>;
  workloadLabels: WorkloadLabels;
  canUseManagementOverride?: boolean;
}) {
  const t = useTranslations("executive");
  const tCases = useTranslations("cases");
  const labels = useDomainLabels();
  const [query, setQuery] = useState("");

  const overviewKpis = useMemo((): StatItem[] => {
    const signedProtocolMissing =
      portfolio.signedProtocol.find((row) => row.key === "missing")?.count ?? 0;

    return [
      {
        key: "totalUnits",
        label: t("stats.totalUnits"),
        value: portfolio.totalUnits,
        href: "/units",
      },
      {
        key: "openTotal",
        label: kpiLabels.openTotal,
        value: data.global.stats.openTotal,
        href: buildCasesFilterUrl({ status: "open" }),
      },
      {
        key: "unassigned",
        label: kpiLabels.unassigned,
        value: data.global.stats.unassigned,
        href: buildCasesFilterUrl({ status: "open", agent: "unassigned" }),
      },
      {
        key: "legal",
        label: kpiLabels.legal,
        value: data.global.stats.legal,
        href: buildCasesFilterUrl({ status: "LEGAL" }),
      },
      {
        key: "engineering",
        label: kpiLabels.engineering,
        value: data.global.stats.engineering,
        href: buildCasesFilterUrl({ status: "ENGINEERING" }),
      },
      {
        key: "pendingWithParty",
        label: t("stats.pendingWithParty"),
        value: data.global.stats.pendingWithParty,
        href: buildCasesFilterUrl({ status: "open" }),
      },
      {
        key: "followUpDue",
        label: t("stats.followUpDue"),
        value: portfolio.followUpDueToday + portfolio.followUpOverdue,
        href: buildCasesFilterUrl({ status: "open", followUp: "due" }),
      },
      {
        key: "deliveredUnits",
        label: t("stats.deliveredUnits"),
        value: portfolio.deliveredUnits,
        href: "/units",
      },
      {
        key: "deliveryOverdue",
        label: t("stats.deliveryOverdue"),
        value: portfolio.deliveryOverdue,
        href: "/units",
      },
      {
        key: "legalRiskUnits",
        label: t("stats.legalRiskUnits"),
        value: portfolio.legalRiskUnits,
        href: "/units",
      },
      {
        key: "signedProtocolMissing",
        label: t("stats.signedProtocolMissing"),
        value: signedProtocolMissing,
        href: "/units",
      },
      {
        key: "feesOutstanding",
        label: t("stats.feesOutstanding"),
        value: portfolio.feesOutstanding,
        href: "/units",
      },
    ];
  }, [data.global.stats, kpiLabels, portfolio, t]);

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
      <div className="space-y-3">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            {t("keyMetricsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("keyMetricsSubtitle")}
          </p>
        </div>
        <ExecutiveKpiGrid items={overviewKpis} />
      </div>

      {financials ? <ExecutiveFinancialsPanel financials={financials} /> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <HandoverPipelineChart
          pipeline={portfolio.handoverPipeline}
          className="shadow-sm"
        />
        <FinishingPipelineChart
          phases={portfolio.finishingPhases}
          className="shadow-sm"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProjectDistributionChart
          data={data.global.projectsOpenCounts}
          className="shadow-sm"
          statusScope="open"
        />
        <StatusDonutChart
          breakdown={data.global.categoryBreakdown}
          className="shadow-sm"
          statusScope="open"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PendingPartiesChart
          breakdown={data.global.pendingPartyBreakdown}
          className="shadow-sm"
        />
        <SignedProtocolChart
          slices={portfolio.signedProtocol}
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
              canUseManagementOverride={canUseManagementOverride}
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
              canUseManagementOverride={canUseManagementOverride}
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
