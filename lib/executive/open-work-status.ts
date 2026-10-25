import type { ExecutiveCaseRow } from "@/lib/cases/executive-dashboard";

/** Open ticket workflow statuses used for per-unit primary classification. */
export type OpenWorkPrimaryStatus = "PENDING" | "ENGINEERING" | "LEGAL";

export type OpenWorkPrimaryStatusBreakdown = Record<
  OpenWorkPrimaryStatus,
  number
>;

/**
 * Most advanced open status for one unit (across all its open tickets).
 * Precedence (highest wins): Legal → Engineering → Pending.
 * Legal if any open ticket has status LEGAL or category LEGAL.
 */
export function primaryOpenStatusForUnit(
  unitRows: ExecutiveCaseRow[]
): OpenWorkPrimaryStatus {
  let hasLegal = false;
  let hasEngineering = false;

  for (const row of unitRows) {
    if (row.status === "LEGAL" || row.category === "LEGAL") {
      hasLegal = true;
    }
    if (row.status === "ENGINEERING") {
      hasEngineering = true;
    }
  }

  if (hasLegal) return "LEGAL";
  if (hasEngineering) return "ENGINEERING";
  return "PENDING";
}

/** Partition open-work units by primary status; counts sum to distinct open units. */
export function computeOpenWorkPrimaryStatusBreakdown(
  rows: ExecutiveCaseRow[]
): OpenWorkPrimaryStatusBreakdown {
  const byUnit = new Map<string, ExecutiveCaseRow[]>();

  for (const row of rows) {
    const list = byUnit.get(row.unitId) ?? [];
    list.push(row);
    byUnit.set(row.unitId, list);
  }

  const counts: OpenWorkPrimaryStatusBreakdown = {
    PENDING: 0,
    ENGINEERING: 0,
    LEGAL: 0,
  };

  for (const unitRows of byUnit.values()) {
    counts[primaryOpenStatusForUnit(unitRows)] += 1;
  }

  return counts;
}
