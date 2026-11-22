import { PROJECT_SLUGS, type CanonicalProject } from "@/lib/projects";

import type { OpenWorkPrimaryStatus } from "@/lib/executive/open-work-status";

export type CaseMetricCategoryKey =
  | "legal"
  | "engineering"
  | "customerService"
  | "feedbackHistory"
  | "general";

export type CasesFilterParams = {
  status?: "open" | "PENDING" | "ENGINEERING" | "LEGAL" | "RESOLVED";
  project?: string;
  category?: string;
  agent?: string;
  followUp?: "due";
  pendingParty?: string;
  /** One row per unit — matches executive KPI distinct-unit counts. */
  distinctUnit?: boolean;
  /** Team queue only (excludes viewer-owned cases); requires viewer on cases page. */
  queue?: "team";
  /** Primary open-work status per unit (Legal > Engineering > Pending). */
  primaryStatus?: OpenWorkPrimaryStatus;
  /** Category donut drill-down (distinct units when combined with distinctUnit). */
  metricCategory?: CaseMetricCategoryKey;
  /** Distinct open units waiting on any non-NONE pending party. */
  awaitingParty?: boolean;
};

export function buildCasesFilterUrl(params: CasesFilterParams): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.project) search.set("project", params.project);
  if (params.category) search.set("category", params.category);
  if (params.agent) search.set("agent", params.agent);
  if (params.followUp) search.set("followUp", params.followUp);
  if (params.pendingParty) search.set("pendingParty", params.pendingParty);
  if (params.distinctUnit) search.set("distinctUnit", "1");
  if (params.queue) search.set("queue", params.queue);
  if (params.primaryStatus) search.set("primaryStatus", params.primaryStatus);
  if (params.metricCategory) search.set("metricCategory", params.metricCategory);
  if (params.awaitingParty) search.set("awaitingParty", "1");
  const query = search.toString();
  return query ? `/cases?${query}` : "/cases";
}

export function slugToProjectName(slug: string): string | null {
  for (const [name, value] of Object.entries(PROJECT_SLUGS) as Array<
    [CanonicalProject, string]
  >) {
    if (value === slug) return name;
  }
  return null;
}

export function projectNameToSlug(name: string): string {
  if (name in PROJECT_SLUGS) {
    return PROJECT_SLUGS[name as CanonicalProject];
  }
  return name.toLowerCase().replace(/\s+/g, "-");
}

export type CasesPageFilters = {
  status: "all" | "open" | "PENDING" | "ENGINEERING" | "LEGAL" | "RESOLVED";
  project: string;
  category: string;
  agent: string;
  followUp: "all" | "due";
  pendingParty: string;
  distinctUnit: boolean;
  queue: "all" | "team";
  primaryStatus: OpenWorkPrimaryStatus | "all";
  metricCategory: CaseMetricCategoryKey | "all";
  awaitingParty: boolean;
};

/** Map `?agent=` URL param (id, name, or sentinel) to the Cases table filter value. */
export function resolveAgentFilterParam(
  param: string,
  agents: Array<{ id: string; name: string }>
): string {
  if (param === "all") return "all";
  if (param === "unassigned") return "unassigned";
  const byId = agents.find((agent) => agent.id === param);
  if (byId) return byId.name;
  if (agents.some((agent) => agent.name === param)) return param;
  return param;
}

export function buildCasesPageUrl(filters: CasesPageFilters): string {
  const params: CasesFilterParams = {};
  if (filters.status !== "all") params.status = filters.status;
  if (filters.project !== "all") params.project = filters.project;
  if (filters.category !== "all") params.category = filters.category;
  if (filters.agent !== "all") params.agent = filters.agent;
  if (filters.followUp === "due") params.followUp = "due";
  if (filters.pendingParty !== "all") params.pendingParty = filters.pendingParty;
  if (filters.distinctUnit) params.distinctUnit = true;
  if (filters.queue === "team") params.queue = "team";
  if (filters.primaryStatus !== "all") {
    params.primaryStatus = filters.primaryStatus;
  }
  if (filters.metricCategory !== "all") {
    params.metricCategory = filters.metricCategory;
  }
  if (filters.awaitingParty) params.awaitingParty = true;
  return buildCasesFilterUrl(params);
}

export function isCasesFilterActive(filters: CasesPageFilters): boolean {
  return (
    filters.status !== "all" ||
    filters.project !== "all" ||
    filters.category !== "all" ||
    filters.agent !== "all" ||
    filters.followUp === "due" ||
    filters.pendingParty !== "all" ||
    filters.distinctUnit ||
    filters.queue === "team" ||
    filters.primaryStatus !== "all" ||
    filters.metricCategory !== "all" ||
    filters.awaitingParty
  );
}

export function parseCasesPageFilters(
  searchParams: Record<string, string | string[] | undefined>
): CasesPageFilters {
  const rawStatus = String(searchParams.status ?? "all");
  const status =
    rawStatus === "open" ||
    rawStatus === "PENDING" ||
    rawStatus === "ENGINEERING" ||
    rawStatus === "LEGAL" ||
    rawStatus === "RESOLVED"
      ? rawStatus
      : "all";

  const rawFollowUp = String(searchParams.followUp ?? "all");
  const rawPrimary = String(searchParams.primaryStatus ?? "all");
  const primaryStatus =
    rawPrimary === "PENDING" ||
    rawPrimary === "ENGINEERING" ||
    rawPrimary === "LEGAL"
      ? rawPrimary
      : "all";
  const rawMetricCategory = String(searchParams.metricCategory ?? "all");
  const metricCategory =
    rawMetricCategory === "legal" ||
    rawMetricCategory === "engineering" ||
    rawMetricCategory === "customerService" ||
    rawMetricCategory === "feedbackHistory" ||
    rawMetricCategory === "general"
      ? rawMetricCategory
      : "all";

  return {
    status,
    project: String(searchParams.project ?? "all"),
    category: String(searchParams.category ?? "all"),
    agent: String(searchParams.agent ?? "all"),
    followUp: rawFollowUp === "due" ? "due" : "all",
    pendingParty: String(searchParams.pendingParty ?? "all"),
    distinctUnit: String(searchParams.distinctUnit ?? "") === "1",
    queue: String(searchParams.queue ?? "") === "team" ? "team" : "all",
    primaryStatus,
    metricCategory,
    awaitingParty: String(searchParams.awaitingParty ?? "") === "1",
  };
}
