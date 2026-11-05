import { describe, expect, it } from "vitest";

import {
  buildOverdueTasksPageUrl,
  matchesOverdueTasksFilters,
  parseOverdueTasksPageFilters,
} from "@/lib/unit-cycle/overdue-filter-url";
import {
  filterOverdueStageRows,
  groupOverdueStageRows,
  summarizeOverdueByStage,
  type OverdueStageRow,
} from "@/lib/unit-cycle/queries";
import {
  groupOverdueStagesForDigest,
} from "@/lib/unit-cycle/overdue-digest";
import {
  resolveStageOwnerRole,
  viewerOwnsStageByRole,
} from "@/lib/unit-cycle/owners";
import { unitCycleStageLabelEnAr } from "@/lib/unit-cycle/stage-labels";

const sampleRow = (
  overrides: Partial<OverdueStageRow> = {}
): OverdueStageRow => ({
  unitCycleId: "cycle-1",
  unitId: "unit-1",
  unitCode: "GA-1",
  projectId: "proj-1",
  projectName: "Green Avenue",
  stageKey: "CONTRACT",
  status: "IN_PROGRESS",
  deadlineAt: "2020-01-01T00:00:00.000Z",
  overdue: true,
  checklistComplete: false,
  checklistPassed: 1,
  checklistTotal: 4,
  daysOverdue: 10,
  ownerRole: "MANAGEMENT",
  ownerAssigneeName: null,
  assigneeUserId: null,
  unitAgentId: null,
  assignedUserId: null,
  claimable: false,
  ...overrides,
});

describe("overdue filter url", () => {
  it("parses filters from search params", () => {
    expect(
      parseOverdueTasksPageFilters({
        project: "green-avenue",
        stage: "FINANCE",
        department: "FINANCE",
        minDays: "7",
      })
    ).toEqual({
      project: "green-avenue",
      stage: "FINANCE",
      department: "FINANCE",
      minDays: "7",
    });
  });

  it("builds overdue tasks url with filters", () => {
    expect(
      buildOverdueTasksPageUrl({ project: "green-avenue", stage: "CONTRACT" })
    ).toBe("/executive/overdue-tasks?project=green-avenue&stage=CONTRACT");
  });
});

describe("overdue stage queries helpers", () => {
  it("summarizes counts by stage", () => {
    const summary = summarizeOverdueByStage([
      sampleRow({ stageKey: "CONTRACT" }),
      sampleRow({ unitId: "u2", stageKey: "CONTRACT" }),
      sampleRow({ unitId: "u3", stageKey: "FINANCE", ownerRole: "FINANCE" }),
    ]);
    expect(summary).toEqual([
      { stageKey: "CONTRACT", count: 2 },
      { stageKey: "FINANCE", count: 1 },
    ]);
  });

  it("filters rows by department and min days", () => {
    const rows = [
      sampleRow({ daysOverdue: 2, ownerRole: "MANAGEMENT" }),
      sampleRow({ unitId: "u2", daysOverdue: 8, ownerRole: "FINANCE", stageKey: "FINANCE" }),
    ];
    const filtered = filterOverdueStageRows(rows, {
      project: "all",
      stage: "all",
      department: "FINANCE",
      minDays: "7",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.unitId).toBe("u2");
    expect(
      matchesOverdueTasksFilters(filtered[0]!, {
        project: "all",
        stage: "all",
        department: "FINANCE",
        minDays: "7",
      }, new Map([["proj-1", "green-avenue"]]))
    ).toBe(true);
  });

  it("groups rows by stage and owner", () => {
    const grouped = groupOverdueStageRows([
      sampleRow(),
      sampleRow({ unitId: "u2", ownerRole: "MANAGEMENT" }),
      sampleRow({
        unitId: "u3",
        stageKey: "ENGINEERING",
        ownerRole: "CS_AGENT",
        ownerAssigneeName: "Agent A",
      }),
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.owners).toHaveLength(1);
  });
});

describe("unit cycle escalation digest", () => {
  it("groups overdue rows by project and stage", () => {
    const groups = groupOverdueStagesForDigest([
      sampleRow(),
      sampleRow({ unitId: "u2" }),
      sampleRow({ unitId: "u3", stageKey: "FINANCE", ownerRole: "FINANCE" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.unitCount).toBe(2);
    expect(unitCycleStageLabelEnAr("CONTRACT").en).toBe("Contract");
  });
});

describe("viewer stage ownership", () => {
  it("limits management ownership to contract stage", () => {
    expect(
      viewerOwnsStageByRole("MANAGEMENT", "CONTRACT")
    ).toBe(true);
    expect(
      viewerOwnsStageByRole("MANAGEMENT", "FINANCE")
    ).toBe(false);
  });

  it("requires assigned agent for engineering", () => {
    expect(
      viewerOwnsStageByRole("CS_AGENT", "ENGINEERING", {
        unitAgentId: "agent-1",
        userId: "agent-1",
      })
    ).toBe(true);
    expect(
      viewerOwnsStageByRole("CS_AGENT", "ENGINEERING", {
        unitAgentId: "agent-2",
        userId: "agent-1",
      })
    ).toBe(false);
    expect(resolveStageOwnerRole("LEGAL_HANDOVER")).toBe("LEGAL");
  });
});
