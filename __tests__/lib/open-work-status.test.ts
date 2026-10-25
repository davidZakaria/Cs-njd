import { describe, expect, it } from "vitest";

import type { ExecutiveCaseRow } from "@/lib/cases/executive-dashboard";
import {
  computeOpenWorkPrimaryStatusBreakdown,
  primaryOpenStatusForUnit,
} from "@/lib/executive/open-work-status";
import { countUniqueUnits } from "@/lib/executive/executive-stats";

function row(
  unitId: string,
  overrides: Partial<ExecutiveCaseRow> = {}
): ExecutiveCaseRow {
  return {
    id: `ticket-${unitId}-${overrides.status ?? "PENDING"}`,
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

describe("open-work primary status breakdown", () => {
  it("sums pending, engineering, and legal to open unit total", () => {
    const rows = [
      row("u1", { status: "PENDING" }),
      row("u2", { status: "ENGINEERING" }),
      row("u3", { status: "LEGAL" }),
      row("u4", { status: "PENDING", id: "t4a" }),
      row("u4", { status: "ENGINEERING", id: "t4b" }),
    ];
    const breakdown = computeOpenWorkPrimaryStatusBreakdown(rows);
    const openTotal = countUniqueUnits(rows);

    expect(breakdown.PENDING + breakdown.ENGINEERING + breakdown.LEGAL).toBe(
      openTotal
    );
    expect(openTotal).toBe(4);
    expect(breakdown.ENGINEERING).toBe(2);
    expect(breakdown.LEGAL).toBe(1);
    expect(breakdown.PENDING).toBe(1);
  });

  it("prefers Legal over Engineering when both exist on the unit", () => {
    const rows = [
      row("u1", { status: "ENGINEERING", id: "e" }),
      row("u1", { status: "PENDING", id: "p" }),
      row("u1", { status: "LEGAL", id: "l" }),
    ];
    expect(primaryOpenStatusForUnit(rows)).toBe("LEGAL");
  });

  it("counts Legal category as Legal primary status", () => {
    const rows = [row("u1", { status: "PENDING", category: "LEGAL" })];
    expect(primaryOpenStatusForUnit(rows)).toBe("LEGAL");
  });
});
