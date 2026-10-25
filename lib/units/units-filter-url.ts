/** Handover status sets aligned with dashboard stat cards. */

import { projectNameToSlug } from "@/lib/cases/cases-filter-url";
import {
  AT_RISK_HANDOVER_STATUSES,
  DELIVERED_HANDOVER_STATUSES,
  LEGAL_DISPUTE_HANDOVER_STATUSES,
} from "@/lib/executive/handover-status-groups";

export const DELIVERED_HANDOVER_STATUSES_EXPORT = DELIVERED_HANDOVER_STATUSES;
export const LEGAL_DISPUTE_HANDOVER_STATUSES_EXPORT =
  LEGAL_DISPUTE_HANDOVER_STATUSES;

export type UnitsHandoverGroup = "all" | "delivered" | "legal" | "atRisk";

export type UnitsFilterParams = {
  handover?: Exclude<UnitsHandoverGroup, "all">;
  delivery?: "overdue";
  fees?: "outstanding";
  signedProtocol?: "missing";
  agent?: "unassigned";
  project?: string;
};

export function buildUnitsPageUrl(filters: UnitsPageFilters): string {
  const params: UnitsFilterParams = {};
  if (filters.handover !== "all") params.handover = filters.handover;
  if (filters.delivery === "overdue") params.delivery = "overdue";
  if (filters.fees === "outstanding") params.fees = "outstanding";
  if (filters.signedProtocol === "missing") params.signedProtocol = "missing";
  if (filters.agent === "unassigned") params.agent = "unassigned";
  if (filters.project !== "all") params.project = filters.project;
  return buildUnitsFilterUrl(params);
}

export function isUnitsFilterActive(filters: UnitsPageFilters): boolean {
  return (
    filters.handover !== "all" ||
    filters.delivery !== "overdue" ||
    filters.fees !== "outstanding" ||
    filters.signedProtocol !== "missing" ||
    filters.agent === "unassigned" ||
    filters.project !== "all"
  );
}

export function resolveUnitsProjectFilterParam(
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

export function buildUnitsFilterUrl(params: UnitsFilterParams = {}): string {
  const search = new URLSearchParams();
  if (params.handover) search.set("handover", params.handover);
  if (params.delivery) search.set("delivery", params.delivery);
  if (params.fees) search.set("fees", params.fees);
  if (params.signedProtocol) search.set("signedProtocol", params.signedProtocol);
  if (params.agent) search.set("agent", params.agent);
  if (params.project) search.set("project", params.project);
  const query = search.toString();
  return query ? `/units?${query}` : "/units";
}

export type UnitsPageFilters = {
  handover: UnitsHandoverGroup;
  delivery: "all" | "overdue";
  fees: "all" | "outstanding";
  signedProtocol: "all" | "missing";
  agent: "all" | "unassigned";
  project: string;
};

export function parseUnitsPageFilters(
  searchParams: Record<string, string | string[] | undefined>
): UnitsPageFilters {
  const rawHandover = String(searchParams.handover ?? "all");
  const handover =
    rawHandover === "delivered" ||
    rawHandover === "legal" ||
    rawHandover === "atRisk"
      ? rawHandover
      : "all";

  const delivery =
    String(searchParams.delivery ?? "all") === "overdue" ? "overdue" : "all";
  const fees =
    String(searchParams.fees ?? "all") === "outstanding"
      ? "outstanding"
      : "all";
  const signedProtocol =
    String(searchParams.signedProtocol ?? "all") === "missing"
      ? "missing"
      : "all";
  const agent =
    String(searchParams.agent ?? "all") === "unassigned" ? "unassigned" : "all";
  const project = String(searchParams.project ?? "all");

  return {
    handover,
    delivery,
    fees,
    signedProtocol,
    agent,
    project,
  };
}

export function handoverStatusesForGroup(
  group: UnitsHandoverGroup
): readonly string[] | null {
  if (group === "delivered") return DELIVERED_HANDOVER_STATUSES;
  if (group === "legal") return LEGAL_DISPUTE_HANDOVER_STATUSES;
  if (group === "atRisk") return AT_RISK_HANDOVER_STATUSES;
  return null;
}

export function matchesUnitsHandoverGroup(
  handoverStatus: string,
  group: UnitsHandoverGroup
): boolean {
  const statuses = handoverStatusesForGroup(group);
  if (!statuses) return true;
  return statuses.includes(handoverStatus);
}
