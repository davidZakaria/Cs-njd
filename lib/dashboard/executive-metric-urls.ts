import {
  buildCasesFilterUrl,
  type CasesFilterParams,
} from "@/lib/cases/cases-filter-url";
import type { CategoryChartKey } from "@/lib/executive/chart-theme";
import type { ActivePendingParty } from "@/lib/executive/pending-party-primary";

const distinctOpen = (extra: Omit<CasesFilterParams, "status" | "distinctUnit"> = {}) =>
  buildCasesFilterUrl({ status: "open", distinctUnit: true, ...extra });

export const executiveCaseMetricUrls = {
  openTotal: (project?: string) =>
    distinctOpen(project ? { project } : {}),
  unassigned: () =>
    buildCasesFilterUrl({
      status: "open",
      agent: "unassigned",
      distinctUnit: true,
      queue: "team",
    }),
  openLegal: (project?: string) =>
    buildCasesFilterUrl({
      status: "open",
      primaryStatus: "LEGAL",
      distinctUnit: true,
      ...(project ? { project } : {}),
    }),
  openEngineering: (project?: string) =>
    buildCasesFilterUrl({
      status: "open",
      primaryStatus: "ENGINEERING",
      distinctUnit: true,
      ...(project ? { project } : {}),
    }),
  openPending: (project?: string) =>
    buildCasesFilterUrl({
      status: "open",
      primaryStatus: "PENDING",
      distinctUnit: true,
      ...(project ? { project } : {}),
    }),
  awaitingParty: (project?: string) =>
    buildCasesFilterUrl({
      status: "open",
      distinctUnit: true,
      awaitingParty: true,
      ...(project ? { project } : {}),
    }),
  pendingParty: (party: ActivePendingParty, project?: string) =>
    buildCasesFilterUrl({
      status: "open",
      distinctUnit: true,
      pendingParty: party,
      ...(project ? { project } : {}),
    }),
  followUpDue: () =>
    buildCasesFilterUrl({ status: "open", followUp: "due" }),
  resolvedTotal: (project?: string) =>
    buildCasesFilterUrl({
      status: "RESOLVED",
      distinctUnit: true,
      ...(project ? { project } : {}),
    }),
  categoryMetric: (
    key: CategoryChartKey,
    options?: { project?: string; resolved?: boolean }
  ) =>
    buildCasesFilterUrl({
      status: options?.resolved ? "RESOLVED" : "open",
      distinctUnit: !options?.resolved,
      metricCategory: key,
      ...(options?.project ? { project: options.project } : {}),
    }),
  agentOpen: (agentId: string) =>
    buildCasesFilterUrl({ status: "open", agent: agentId }),
};