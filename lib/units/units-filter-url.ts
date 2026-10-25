/** Handover status sets aligned with dashboard stat cards. */

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
