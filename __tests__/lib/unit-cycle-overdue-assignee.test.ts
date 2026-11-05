import { describe, expect, it } from "vitest";

import { resolveOverdueOwnerAssigneeName } from "@/lib/unit-cycle/overdue-assignee";
import {
  formatOverdueDigestMessage,
  groupOverdueStagesForDepartmentPoolDigest,
} from "@/lib/unit-cycle/overdue-digest";
import type { OverdueStageRow } from "@/lib/unit-cycle/queries";

const baseRow = (
  overrides: Partial<OverdueStageRow> = {}
): OverdueStageRow => ({
  unitCycleId: "c1",
  unitId: "u1",
  unitCode: "GA-1",
  projectId: "p1",
  projectName: "Green Avenue",
  stageKey: "FINANCE",
  status: "IN_PROGRESS",
  deadlineAt: null,
  overdue: true,
  checklistComplete: false,
  checklistPassed: 0,
  checklistTotal: 1,
  daysOverdue: 2,
  ownerRole: "FINANCE",
  ownerAssigneeName: null,
  assigneeUserId: null,
  assignedUserId: null,
  unitAgentId: null,
  claimable: false,
  ...overrides,
});

describe("resolveOverdueOwnerAssigneeName", () => {
  it("uses claimed assignee name for finance stages", () => {
    expect(
      resolveOverdueOwnerAssigneeName({
        stageKey: "FINANCE",
        assignedUserId: "user-1",
        assignedUserName: "Fady",
        unitAgentId: null,
        unitAgentName: null,
      })
    ).toBe("Fady");
  });

  it("returns null for unclaimed finance pool tasks", () => {
    expect(
      resolveOverdueOwnerAssigneeName({
        stageKey: "FINANCE",
        assignedUserId: null,
        assignedUserName: null,
        unitAgentId: null,
        unitAgentName: null,
      })
    ).toBeNull();
  });
});

describe("formatOverdueDigestMessage", () => {
  it("lists counts for every overdue stage", () => {
    const message = formatOverdueDigestMessage([
      baseRow({ stageKey: "FINANCE" }),
      baseRow({ unitId: "u2", stageKey: "CONTRACT" }),
      baseRow({ unitId: "u3", stageKey: "CONTRACT" }),
    ]);

    expect(message.en).toContain("3 unit(s) overdue");
    expect(message.en).toContain("2 in Contract");
    expect(message.en).toContain("1 in Finance");
    expect(message.ar).toContain("3 وحدة متأخرة");
    expect(message.ar).toContain("الحسابات");
  });
});

describe("groupOverdueStagesForDepartmentPoolDigest", () => {
  it("groups unclaimed rows by department role", () => {
    const groups = groupOverdueStagesForDepartmentPoolDigest([
      baseRow({ ownerRole: "FINANCE", assigneeUserId: null }),
      baseRow({
        unitId: "u2",
        ownerRole: "LEGAL",
        stageKey: "LEGAL_HANDOVER",
        assigneeUserId: null,
      }),
      baseRow({ unitId: "u3", assigneeUserId: "claimed" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.ownerRole === "FINANCE")?.rows).toHaveLength(1);
  });
});
