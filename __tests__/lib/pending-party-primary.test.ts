import { describe, expect, it } from "vitest";

import type { ExecutiveCaseRow } from "@/lib/cases/executive-dashboard";
import { countUniqueUnits } from "@/lib/executive/executive-stats";
import {
  computePrimaryPendingPartyBreakdown,
  primaryPendingPartyForUnit,
  sumPrimaryPendingPartyBreakdown,
} from "@/lib/executive/pending-party-primary";

function row(
  unitId: string,
  overrides: Partial<ExecutiveCaseRow> = {}
): ExecutiveCaseRow {
  return {
    id: `ticket-${unitId}-${overrides.pendingParty ?? "NONE"}`,
    unitId,
    unitCode: unitId,
    project: "P",
    client: "C",
    notes: "",
    category: "GENERAL",
    status: "PENDING",
    pendingParty: "NONE",
    agentId: null,
    agentName: "-",
    unitAgentId: null,
    isMine: false,
    ...overrides,
  };
}

describe("primary pending party breakdown", () => {
  it("sums party buckets to distinct units waiting on a party", () => {
    const rows = [
      row("u1", { pendingParty: "CLIENT" }),
      row("u2", { pendingParty: "CUSTOMER_SERVICE" }),
      row("u3", { pendingParty: "ENGINEERING", id: "t3a" }),
      row("u3", { pendingParty: "LEGAL", id: "t3b" }),
      row("u4", { pendingParty: "NONE" }),
    ];
    const breakdown = computePrimaryPendingPartyBreakdown(rows);
    const waitingTotal = countUniqueUnits(
      rows,
      (r) => r.pendingParty !== "NONE"
    );

    expect(sumPrimaryPendingPartyBreakdown(breakdown)).toBe(waitingTotal);
    expect(waitingTotal).toBe(3);
    expect(breakdown.CUSTOMER_SERVICE).toBe(1);
    expect(breakdown.CLIENT).toBe(1);
    expect(breakdown.LEGAL).toBe(1);
    expect(breakdown.ENGINEERING).toBe(0);
  });

  it("prefers Legal over Engineering on the same unit", () => {
    const rows = [
      row("u1", { pendingParty: "ENGINEERING", id: "e" }),
      row("u1", { pendingParty: "LEGAL", id: "l" }),
    ];
    expect(primaryPendingPartyForUnit(rows)).toBe("LEGAL");
  });
});
