"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

import { ExecutiveCaseSearchBar } from "@/components/executive/executive-case-search-bar";
import { ExecutiveQuickActionsTable } from "@/components/executive/executive-quick-actions-table";
import {
  buildExecutiveKpiItems,
  ExecutiveKpiGrid,
  type StatItem,
} from "@/components/executive/executive-kpi-grid";
import { ExecutiveAgentWorkloadGrid } from "@/components/executive/executive-agent-workload-grid";
import { ExecutiveQueueSection } from "@/components/executive/executive-queue-section";
import { StatusDonutChart } from "@/components/executive/status-donut-chart";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDomainLabels } from "@/hooks/use-domain-labels";
import { buildCasesFilterUrl } from "@/lib/cases/cases-filter-url";
import { filterExecutiveCaseRows } from "@/lib/executive/filter-case-rows";
import type {
  ExecutiveDashboardData,
  ProjectDashboardSlice,
} from "@/lib/cases/executive-dashboard";
import type { ExecutiveKpiKey } from "@/components/executive/executive-kpi-grid";
import { cn } from "@/lib/utils";

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
  const [openQuery, setOpenQuery] = useState("");
  const [resolvedQuery, setResolvedQuery] = useState("");

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

  const resolvedKpis = useMemo(
    (): StatItem[] => [
      {
        key: "resolvedTotal",
        label: t("stats.resolvedTotal"),
        value: slice.resolvedStats.resolvedTotal,
        href: buildCasesFilterUrl({
          status: "RESOLVED",
          project: slice.slug,
        }),
      },
      {
        key: "myResolved",
        label: t("stats.myResolved"),
        value: slice.resolvedStats.myResolved,
        href: buildCasesFilterUrl({
          status: "RESOLVED",
          project: slice.slug,
        }),
      },
      {
        key: "teamResolved",
        label: t("stats.teamResolved"),
        value: slice.resolvedStats.teamResolved,
        href: buildCasesFilterUrl({
          status: "RESOLVED",
          project: slice.slug,
        }),
      },
    ],
    [slice.resolvedStats, slice.slug, t]
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
    () => filterExecutiveCaseRows(slice.teamQueue, openQuery, searchContext),
    [slice.teamQueue, openQuery, searchContext]
  );

  const filteredMyQueue = useMemo(
    () => filterExecutiveCaseRows(slice.myQueue, openQuery, searchContext),
    [slice.myQueue, openQuery, searchContext]
  );

  const filteredResolvedTeamQueue = useMemo(
    () =>
      filterExecutiveCaseRows(
        slice.resolvedTeamQueue,
        resolvedQuery,
        searchContext
      ),
    [slice.resolvedTeamQueue, resolvedQuery, searchContext]
  );

  const filteredResolvedMyQueue = useMemo(
    () =>
      filterExecutiveCaseRows(slice.resolvedMyQueue, resolvedQuery, searchContext),
    [slice.resolvedMyQueue, resolvedQuery, searchContext]
  );

  const hasOpenCases = slice.stats.openTotal > 0;
  const hasResolvedCases = slice.resolvedStats.resolvedTotal > 0;
  const isOpenSearching = openQuery.trim().length > 0;
  const isResolvedSearching = resolvedQuery.trim().length > 0;
  const openTotalMatches = filteredTeamQueue.length + filteredMyQueue.length;
  const openTotalCases = slice.teamQueue.length + slice.myQueue.length;
  const resolvedTotalMatches =
    filteredResolvedTeamQueue.length + filteredResolvedMyQueue.length;
  const resolvedTotalCases =
    slice.resolvedTeamQueue.length + slice.resolvedMyQueue.length;

  if (!hasOpenCases && !hasResolvedCases) {
    return (
      <p className="rounded-xl border border-dashed bg-muted/20 py-12 text-center text-sm text-muted-foreground">
        {t("noProjectCases")}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {hasOpenCases ? (
        <>
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
            query={openQuery}
            onQueryChange={setOpenQuery}
            title={t("searchTitle")}
            subtitle={t("searchSubtitleProject")}
            placeholder={t("searchPlaceholder")}
            totalMatches={openTotalMatches}
            totalCases={openTotalCases}
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
              emptyLabel={
                isOpenSearching ? t("searchNoResults") : t("teamQueueEmpty")
              }
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
              emptyLabel={
                isOpenSearching ? t("searchNoResults") : t("myQueueEmpty")
              }
            />
          </ExecutiveQueueSection>
        </>
      ) : (
        <p className="rounded-xl border border-dashed bg-muted/20 py-8 text-center text-sm text-muted-foreground">
          {t("noOpenProjectCases")}
        </p>
      )}

      {hasResolvedCases ? (
        <>
          {hasOpenCases ? <Separator className="my-2" /> : null}

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <ExecutiveKpiGrid items={resolvedKpis} />
            </div>
            <Link
              href={buildCasesFilterUrl({
                status: "RESOLVED",
                project: slice.slug,
              })}
              className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
            >
              {t("viewProjectResolved")}
            </Link>
          </div>

          <StatusDonutChart
            breakdown={slice.resolvedCategoryBreakdown}
            title={t("projectResolvedByCategory")}
            className="max-w-md shadow-sm"
            statusScope="RESOLVED"
            projectSlug={slice.slug}
          />

          <ExecutiveCaseSearchBar
            query={resolvedQuery}
            onQueryChange={setResolvedQuery}
            title={t("projectResolvedSearchTitle")}
            subtitle={t("projectResolvedSearchSubtitle")}
            placeholder={t("searchPlaceholder")}
            totalMatches={resolvedTotalMatches}
            totalCases={resolvedTotalCases}
            teamMatches={filteredResolvedTeamQueue.length}
            myMatches={filteredResolvedMyQueue.length}
            teamLabel={t("stats.teamResolved")}
            myLabel={t("stats.myResolved")}
          />

          <ExecutiveQueueSection
            title={t("projectResolvedTeamQueueTitle")}
            subtitle={t("projectResolvedTeamQueueSubtitle")}
          >
            <ExecutiveQuickActionsTable
              rows={filteredResolvedTeamQueue}
              agents={agents}
              canAssign={false}
              emptyLabel={
                isResolvedSearching
                  ? t("searchNoResults")
                  : t("projectResolvedTeamQueueEmpty")
              }
            />
          </ExecutiveQueueSection>

          <ExecutiveQueueSection
            title={t("projectResolvedMyQueueTitle")}
            subtitle={t("projectResolvedMyQueueSubtitle")}
          >
            <ExecutiveQuickActionsTable
              rows={filteredResolvedMyQueue}
              agents={agents}
              canAssign={false}
              emptyLabel={
                isResolvedSearching
                  ? t("searchNoResults")
                  : t("projectResolvedMyQueueEmpty")
              }
            />
          </ExecutiveQueueSection>
        </>
      ) : null}
    </div>
  );
}
