/** Handover status sets aligned with dashboard stat cards. */

export const DELIVERED_HANDOVER_STATUSES = [
  "DELIVERY_PROTOCOL",
  "DELIVERED",
] as const;

export const LEGAL_DISPUTE_HANDOVER_STATUSES = [
  "REFUSED_DELIVERY",
  "REFUSED_EXTENSION",
  "INSTALLMENT_STOP_WARNING",
  "DELIVERY_WARNING",
  "LEGAL_DISPUTE",
] as const;

export type UnitsHandoverGroup = "all" | "delivered" | "legal";

export type UnitsFilterParams = {
  handover?: Exclude<UnitsHandoverGroup, "all">;
};

export function buildUnitsFilterUrl(params: UnitsFilterParams = {}): string {
  const search = new URLSearchParams();
  if (params.handover) search.set("handover", params.handover);
  const query = search.toString();
  return query ? `/units?${query}` : "/units";
}

export type UnitsPageFilters = {
  handover: UnitsHandoverGroup;
};

export function parseUnitsPageFilters(
  searchParams: Record<string, string | string[] | undefined>
): UnitsPageFilters {
  const rawHandover = String(searchParams.handover ?? "all");
  const handover =
    rawHandover === "delivered" || rawHandover === "legal"
      ? rawHandover
      : "all";

  return { handover };
}

export function handoverStatusesForGroup(
  group: UnitsHandoverGroup
): readonly string[] | null {
  if (group === "delivered") return DELIVERED_HANDOVER_STATUSES;
  if (group === "legal") return LEGAL_DISPUTE_HANDOVER_STATUSES;
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
