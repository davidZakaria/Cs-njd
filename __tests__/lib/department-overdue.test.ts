import { describe, expect, it } from "vitest";

import {
  departmentOverdueTasksBasePath,
  isDepartmentOverdueHomeRole,
} from "@/lib/unit-cycle/department-overdue";
import { buildOverdueTasksPageUrl } from "@/lib/unit-cycle/overdue-filter-url";
import { splitPersonalAndPoolOverdueRows } from "@/lib/unit-cycle/queries";
import type { OverdueStageRow } from "@/lib/unit-cycle/queries";

describe("department overdue routes", () => {
  it("maps legal and finance to department overdue pages", () => {
    expect(departmentOverdueTasksBasePath("LEGAL")).toBe("/legal/overdue-tasks");
    expect(departmentOverdueTasksBasePath("FINANCE")).toBe("/finance/overdue-tasks");
    expect(isDepartmentOverdueHomeRole("OPERATIONS")).toBe(false);
  });

  it("builds filtered department overdue URLs", () => {
    const url = buildOverdueTasksPageUrl(
      { department: "FINANCE", stage: "FINANCE" },
      { basePath: "/finance/overdue-tasks" }
    );
    expect(url).toContain("/finance/overdue-tasks?");
    expect(url).toContain("department=FINANCE");
    expect(url).toContain("stage=FINANCE");
  });
});

describe("splitPersonalAndPoolOverdueRows", () => {
  it("separates assigned and unclaimed rows", () => {
    const row = (assigneeUserId: string | null): OverdueStageRow => ({
      unitCycleId: "c1",
      unitId: "u1",
      unitCode: "A-1",
      projectId: "p1",
      projectName: "Proj",
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
      assigneeUserId,
      assignedUserId: assigneeUserId,
      unitAgentId: null,
      claimable: false,
    });

    const { personal, pool } = splitPersonalAndPoolOverdueRows(
      [row("user-1"), row(null)],
      "user-1"
    );

    expect(personal).toHaveLength(1);
    expect(pool).toHaveLength(1);
  });
});
