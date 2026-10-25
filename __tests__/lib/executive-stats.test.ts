import { describe, expect, it } from "vitest";

import type { ExecutiveCaseRow } from "@/lib/cases/executive-dashboard";
import {
  computeResolvedStats,
  countUniqueUnits,
} from "@/lib/executive/executive-stats";

function row(
  unitId: string,
  overrides: Partial<ExecutiveCaseRow> = {}
): ExecutiveCaseRow {
  return {
    id: `ticket-${unitId}`,
    unitId,
    unitCode: unitId,
    project: "P",
    client: "C",
    notes: "",
    category: "GENERAL",
    status: "RESOLVED",
    pendingParty: "NONE",
    agentId: null,
    agentName: "-",
    unitAgentId: null,
    isMine: false,
    ...overrides,
  };
}

describe("executive-stats", () => {
  it("counts unique units only once", () => {
    const rows = [
      row("u1"),
      row("u1", { id: "ticket-2" }),
      row("u2"),
    ];
    expect(countUniqueUnits(rows)).toBe(2);
  });

  it("counts resolved stats by unique units not ticket rows", () => {
    const rows = [
      row("u1", { isMine: true }),
      row("u1", { id: "t2", isMine: true }),
      row("u2", { isMine: false }),
    ];
    expect(computeResolvedStats(rows)).toEqual({
      resolvedTotal: 2,
      myResolved: 1,
      teamResolved: 1,
    });
  });
});
