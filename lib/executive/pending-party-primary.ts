import type { ExecutiveCaseRow } from "@/lib/cases/executive-dashboard";

/** Non-NONE pending parties, highest precedence first (used for one party per unit). */
export const PENDING_PARTY_PRECEDENCE = [
  "LEGAL",
  "FINANCE",
  "ENGINEERING",
  "MANAGEMENT",
  "LOGISTICS",
  "CLIENT",
  "CUSTOMER_SERVICE",
] as const;

export type ActivePendingParty = (typeof PENDING_PARTY_PRECEDENCE)[number];

export type PrimaryPendingPartyBreakdown = Record<ActivePendingParty, number>;

export function emptyPrimaryPendingPartyBreakdown(): PrimaryPendingPartyBreakdown {
  return {
    LEGAL: 0,
    FINANCE: 0,
    ENGINEERING: 0,
    MANAGEMENT: 0,
    LOGISTICS: 0,
    CLIENT: 0,
    CUSTOMER_SERVICE: 0,
  };
}

/**
 * One pending party per unit: highest precedence among open tickets with pendingParty ≠ NONE.
 * Precedence: Legal → Finance → Engineering → Management → Logistics → Client → Customer Service.
 */
export function primaryPendingPartyForUnit(
  unitRows: ExecutiveCaseRow[]
): ActivePendingParty | null {
  const parties = new Set<string>();
  for (const row of unitRows) {
    if (row.pendingParty && row.pendingParty !== "NONE") {
      parties.add(row.pendingParty);
    }
  }
  if (parties.size === 0) return null;

  for (const party of PENDING_PARTY_PRECEDENCE) {
    if (parties.has(party)) return party;
  }
  return null;
}

/** Distinct units waiting on another party, split by primary party (sums to waiting-on-party total). */
export function computePrimaryPendingPartyBreakdown(
  rows: ExecutiveCaseRow[]
): PrimaryPendingPartyBreakdown {
  const byUnit = new Map<string, ExecutiveCaseRow[]>();
  for (const row of rows) {
    const list = byUnit.get(row.unitId) ?? [];
    list.push(row);
    byUnit.set(row.unitId, list);
  }

  const counts = emptyPrimaryPendingPartyBreakdown();
  for (const unitRows of byUnit.values()) {
    const primary = primaryPendingPartyForUnit(unitRows);
    if (primary) {
      counts[primary] += 1;
    }
  }
  return counts;
}

export function sumPrimaryPendingPartyBreakdown(
  breakdown: PrimaryPendingPartyBreakdown
): number {
  return PENDING_PARTY_PRECEDENCE.reduce(
    (total, key) => total + breakdown[key],
    0
  );
}
