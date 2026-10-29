import type { UnitRequestStatus, UnitRequestType } from "@prisma/client";

import { PROJECT_SLUGS, type CanonicalProject } from "@/lib/projects";

export type RequestsFilterParams = {
  view?: "awaiting" | "submitted" | "all";
  status?: UnitRequestStatus;
  type?: UnitRequestType;
  project?: string;
  overdue?: "yes";
};

export function buildRequestsFilterUrl(params: RequestsFilterParams): string {
  const search = new URLSearchParams();
  if (params.view) search.set("view", params.view);
  if (params.status) search.set("status", params.status);
  if (params.type) search.set("type", params.type);
  if (params.project) search.set("project", params.project);
  if (params.overdue) search.set("overdue", params.overdue);
  const query = search.toString();
  return query ? `/requests?${query}` : "/requests";
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

export type RequestsPageFilters = {
  view: "awaiting" | "submitted" | "all";
  status: "all" | UnitRequestStatus;
  type: "all" | UnitRequestType;
  project: string;
  overdue: "all" | "yes";
};

export function parseRequestsPageFilters(
  searchParams: Record<string, string | string[] | undefined>
): RequestsPageFilters {
  const pick = (key: string) => {
    const value = searchParams[key];
    return typeof value === "string" ? value : undefined;
  };

  const viewRaw = pick("view");
  const view =
    viewRaw === "submitted" || viewRaw === "all" || viewRaw === "awaiting"
      ? viewRaw
      : "awaiting";

  const statusRaw = pick("status");
  const typeRaw = pick("type");
  const projectSlug = pick("project");
  const overdueRaw = pick("overdue");

  return {
    view,
    status: (statusRaw as RequestsPageFilters["status"]) ?? "all",
    type: (typeRaw as RequestsPageFilters["type"]) ?? "all",
    project: projectSlug ? slugToProjectName(projectSlug) ?? "all" : "all",
    overdue: overdueRaw === "yes" ? "yes" : "all",
  };
}

export function buildRequestsPageUrl(filters: RequestsPageFilters): string {
  const params: RequestsFilterParams = { view: filters.view };
  if (filters.status !== "all") params.status = filters.status;
  if (filters.type !== "all") params.type = filters.type;
  if (filters.project !== "all") params.project = projectNameToSlug(filters.project);
  if (filters.overdue === "yes") params.overdue = "yes";
  return buildRequestsFilterUrl(params);
}

export function isRequestsFilterActive(filters: RequestsPageFilters): boolean {
  return (
    filters.view !== "awaiting" ||
    filters.status !== "all" ||
    filters.type !== "all" ||
    filters.project !== "all" ||
    filters.overdue === "yes"
  );
}
