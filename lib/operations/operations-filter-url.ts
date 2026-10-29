import { projectNameToSlug } from "@/lib/cases/cases-filter-url";
import {
  handoverStatusesForGroup,
  matchesUnitsHandoverGroup,
  type UnitsHandoverGroup,
} from "@/lib/units/units-filter-url";
import type { OperationsProgressItemKey } from "@/lib/operations/operations-progress";
import { OPERATIONS_PROGRESS_ITEM_KEYS } from "@/lib/operations/operations-progress";

export type OperationsProgressFilterParams = {
  project?: string;
  handover?: Exclude<UnitsHandoverGroup, "all">;
  missingItem?: OperationsProgressItemKey;
  agent?: string;
  q?: string;
};

export type OperationsPageFilters = {
  project: string;
  handover: UnitsHandoverGroup;
  missingItem: OperationsProgressItemKey | "all";
  agent: string;
  q: string;
};

export function parseOperationsPageFilters(
  searchParams: Record<string, string | string[] | undefined>
): OperationsPageFilters {
  const rawHandover = String(searchParams.handover ?? "all");
  const handover =
    rawHandover === "delivered" ||
    rawHandover === "legal" ||
    rawHandover === "atRisk"
      ? rawHandover
      : "all";

  const rawMissing = String(searchParams.missingItem ?? "all");
  const missingItem = (
    OPERATIONS_PROGRESS_ITEM_KEYS as readonly string[]
  ).includes(rawMissing)
    ? (rawMissing as OperationsProgressItemKey)
    : "all";

  return {
    project: String(searchParams.project ?? "all"),
    handover,
    missingItem,
    agent: String(searchParams.agent ?? "all"),
    q: String(searchParams.q ?? "").trim(),
  };
}

export function buildOperationsFilterUrl(
  params: OperationsProgressFilterParams = {}
): string {
  const search = new URLSearchParams();
  if (params.project && params.project !== "all") {
    search.set("project", params.project);
  }
  if (params.handover) search.set("handover", params.handover);
  if (params.missingItem) search.set("missingItem", params.missingItem);
  if (params.agent && params.agent !== "all") search.set("agent", params.agent);
  if (params.q?.trim()) search.set("q", params.q.trim());
  const query = search.toString();
  return query ? `/operations?${query}` : "/operations";
}

export function resolveOperationsProjectFilterParam(
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

export function matchesOperationsHandoverFilter(
  handoverStatus: string,
  group: UnitsHandoverGroup
): boolean {
  return matchesUnitsHandoverGroup(handoverStatus, group);
}

export { handoverStatusesForGroup, projectNameToSlug };
