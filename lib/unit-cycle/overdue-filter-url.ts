import type { Role, UnitCycleStageKey } from "@prisma/client";

import { projectNameToSlug } from "@/lib/cases/cases-filter-url";

const STAGE_KEYS: UnitCycleStageKey[] = [
  "CONTRACT",
  "FINANCE",
  "ENGINEERING",
  "LEGAL_HANDOVER",
];

const DEPARTMENT_ROLES: Role[] = [
  "MANAGEMENT",
  "FINANCE",
  "LEGAL",
  "CS_AGENT",
];

export type OverdueTasksPageFilters = {
  project: string;
  stage: UnitCycleStageKey | "all";
  department: Role | "all";
  minDays: "all" | "1" | "3" | "7" | "14";
};

export type OverdueTasksFilterParams = Partial<{
  project: string;
  stage: UnitCycleStageKey;
  department: Role;
  minDays: Exclude<OverdueTasksPageFilters["minDays"], "all">;
}>;

export function parseOverdueTasksPageFilters(
  searchParams: Record<string, string | string[] | undefined>
): OverdueTasksPageFilters {
  const rawStage = String(searchParams.stage ?? "all");
  const stage = STAGE_KEYS.includes(rawStage as UnitCycleStageKey)
    ? (rawStage as UnitCycleStageKey)
    : "all";

  const rawDepartment = String(searchParams.department ?? "all");
  const department = DEPARTMENT_ROLES.includes(rawDepartment as Role)
    ? (rawDepartment as Role)
    : "all";

  const rawMinDays = String(searchParams.minDays ?? "all");
  const minDays =
    rawMinDays === "1" ||
    rawMinDays === "3" ||
    rawMinDays === "7" ||
    rawMinDays === "14"
      ? rawMinDays
      : "all";

  return {
    project: String(searchParams.project ?? "all"),
    stage,
    department,
    minDays,
  };
}

export function buildOverdueTasksPageUrl(
  params: OverdueTasksFilterParams = {}
): string {
  const search = new URLSearchParams();
  if (params.project && params.project !== "all") {
    search.set("project", params.project);
  }
  if (params.stage) search.set("stage", params.stage);
  if (params.department) search.set("department", params.department);
  if (params.minDays) search.set("minDays", params.minDays);
  const query = search.toString();
  return query ? `/executive/overdue-tasks?${query}` : "/executive/overdue-tasks";
}

export function resolveOverdueProjectFilterParam(
  param: string,
  projectNames: string[]
): string {
  if (param === "all") return "all";
  if (projectNames.some((name) => projectNameToSlug(name) === param)) {
    return param;
  }
  const byName = projectNames.find((name) => name === param);
  return byName ? projectNameToSlug(byName) : param;
}

export function matchesOverdueTasksFilters(
  row: {
    projectId: string;
    projectName: string;
    stageKey: string;
    ownerRole: Role;
    daysOverdue: number;
  },
  filters: OverdueTasksPageFilters,
  projectSlugById: Map<string, string>
): boolean {
  if (filters.project !== "all") {
    const slug =
      projectSlugById.get(row.projectId) ?? projectNameToSlug(row.projectName);
    if (slug !== filters.project && row.projectId !== filters.project) {
      return false;
    }
  }
  if (filters.stage !== "all" && row.stageKey !== filters.stage) {
    return false;
  }
  if (filters.department !== "all" && row.ownerRole !== filters.department) {
    return false;
  }
  if (filters.minDays !== "all") {
    const min = Number(filters.minDays);
    if (row.daysOverdue < min) return false;
  }
  return true;
}

export { projectNameToSlug, STAGE_KEYS, DEPARTMENT_ROLES };
