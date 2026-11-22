import { describe, expect, it } from "vitest";

import {
  cleanupApplyFromArgv,
  planRetroactiveUnitCycleDeadlineFixes,
  rowAfterDeadlineFix,
  summarizeDeadlineFixes,
} from "@/lib/unit-cycle/retroactive-deadline-cleanup";

const projectDays = {
  unitCycleContractDeadlineDays: 5,
  unitCycleFinanceDeadlineDays: 5,
  unitCycleEngineeringDeadlineDays: 7,
  unitCycleLegalHandoverDeadlineDays: 7,
};

describe("retroactive deadline cleanup planning", () => {
  it("defaults to dry-run mode unless --apply is passed", () => {
    expect(cleanupApplyFromArgv(["node", "script.ts"])).toBe(false);
    expect(cleanupApplyFromArgv(["node", "script.ts", "--apply"])).toBe(true);
  });

  it("only plans retroactive rows and groups by reason and project", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");
    const cycleCreated = new Date("2024-06-01T00:00:00.000Z");

    const planned = planRetroactiveUnitCycleDeadlineFixes(
      [
        {
          id: "stale",
          status: "IN_PROGRESS",
          stageKey: "CONTRACT",
          startedAt: new Date("2024-06-01T10:00:00.000Z"),
          deadlineAt: new Date("2024-06-03T00:00:00.000Z"),
          unitCycleCreatedAt: cycleCreated,
          unitCode: "GA-001",
          projectName: "GREEN AVENUE",
          projectDeadlineDays: projectDays,
        },
        {
          id: "ok",
          status: "IN_PROGRESS",
          stageKey: "CONTRACT",
          startedAt: now,
          deadlineAt: new Date("2026-04-01T00:00:00.000Z"),
          unitCycleCreatedAt: cycleCreated,
          unitCode: "GA-002",
          projectName: "GREEN AVENUE",
          projectDeadlineDays: projectDays,
        },
      ],
      now
    );

    expect(planned).toHaveLength(1);
    expect(planned[0]?.reason).toBe("active_deadline_in_past");

    const summary = summarizeDeadlineFixes(planned);
    expect(summary.byReason.get("active_deadline_in_past")).toBe(1);
    expect(summary.byProject.get("GREEN AVENUE")).toBe(1);
    expect(summary.byStage.get("CONTRACT")).toBe(1);
  });

  it("is idempotent after applying planned fixes", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");
    const row = {
      id: "stale",
      status: "IN_PROGRESS" as const,
      stageKey: "CONTRACT" as const,
      startedAt: new Date("2024-06-01T10:00:00.000Z"),
      deadlineAt: new Date("2024-06-03T00:00:00.000Z"),
      unitCycleCreatedAt: new Date("2024-06-01T00:00:00.000Z"),
      unitCode: "GA-001",
      projectName: "GREEN AVENUE",
      projectDeadlineDays: projectDays,
    };

    const planned = planRetroactiveUnitCycleDeadlineFixes([row], now);
    expect(planned).toHaveLength(1);

    const fixed = rowAfterDeadlineFix(row, planned[0]!);
    const secondPass = planRetroactiveUnitCycleDeadlineFixes([fixed], now);
    expect(secondPass).toHaveLength(0);
  });
});