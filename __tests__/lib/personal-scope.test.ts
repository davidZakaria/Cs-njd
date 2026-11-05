import { describe, expect, it } from "vitest";

import {
  archiveGapTaskClaimableByUser,
  archiveGapTaskVisibleToUser,
  requestAwaitingVisibleToUser,
  requestClaimableByUser,
  unitCycleStageClaimableByUser,
  unitCycleStageVisibleToUser,
} from "@/lib/work/personal-scope";

describe("personal work scope", () => {
  it("shows unclaimed finance stages to finance pool only", () => {
    expect(
      unitCycleStageVisibleToUser({
        mode: "personal",
        userRole: "FINANCE",
        userId: "fin-1",
        stageKey: "FINANCE",
        stageOwnerRole: "FINANCE",
        assignedUserId: null,
        unitAgentId: null,
        active: true,
      })
    ).toBe(true);
    expect(
      unitCycleStageVisibleToUser({
        mode: "personal",
        userRole: "LEGAL",
        userId: "legal-1",
        stageKey: "FINANCE",
        stageOwnerRole: "FINANCE",
        assignedUserId: null,
        unitAgentId: null,
        active: true,
      })
    ).toBe(false);
  });

  it("hides claimed tasks from other users in the department", () => {
    expect(
      unitCycleStageVisibleToUser({
        mode: "personal",
        userRole: "LEGAL",
        userId: "legal-2",
        stageKey: "LEGAL_HANDOVER",
        stageOwnerRole: "LEGAL",
        assignedUserId: "legal-1",
        unitAgentId: null,
        active: true,
      })
    ).toBe(false);
  });

  it("allows CS agents only on their assigned units", () => {
    expect(
      unitCycleStageVisibleToUser({
        mode: "personal",
        userRole: "CS_AGENT",
        userId: "agent-1",
        stageKey: "ENGINEERING",
        stageOwnerRole: "CS_AGENT",
        assignedUserId: null,
        unitAgentId: "agent-1",
        active: true,
      })
    ).toBe(true);
    expect(
      unitCycleStageVisibleToUser({
        mode: "personal",
        userRole: "CS_AGENT",
        userId: "agent-2",
        stageKey: "ENGINEERING",
        stageOwnerRole: "CS_AGENT",
        assignedUserId: null,
        unitAgentId: "agent-1",
        active: true,
      })
    ).toBe(false);
  });

  it("limits management home to assigned or escalated requests", () => {
    expect(
      requestAwaitingVisibleToUser({
        mode: "personal",
        userRole: "MANAGEMENT",
        userId: "mgmt-1",
        requestedById: "other",
        assignedApproverUserId: "mgmt-1",
        escalatedToManagement: false,
        status: "PENDING",
        canApprove: true,
      })
    ).toBe(true);
    expect(
      requestAwaitingVisibleToUser({
        mode: "personal",
        userRole: "MANAGEMENT",
        userId: "mgmt-1",
        requestedById: "other",
        assignedApproverUserId: null,
        escalatedToManagement: true,
        status: "PENDING",
        canApprove: true,
      })
    ).toBe(true);
    expect(
      requestAwaitingVisibleToUser({
        mode: "personal",
        userRole: "MANAGEMENT",
        userId: "mgmt-1",
        requestedById: "other",
        assignedApproverUserId: null,
        escalatedToManagement: false,
        status: "PENDING",
        canApprove: true,
      })
    ).toBe(false);
  });

  it("supports claim eligibility for unclaimed pool items", () => {
    expect(
      unitCycleStageClaimableByUser({
        userRole: "FINANCE",
        userId: "fin-1",
        stageKey: "FINANCE",
        stageOwnerRole: "FINANCE",
        assignedUserId: null,
        unitAgentId: null,
      })
    ).toBe(true);
    expect(
      requestClaimableByUser({
        userRole: "OPERATIONS",
        assignedApproverUserId: null,
        canApprove: true,
      })
    ).toBe(true);
    expect(
      archiveGapTaskClaimableByUser({
        userRole: "LEGAL",
        ownerRole: "LEGAL",
        ownerUserId: null,
      })
    ).toBe(true);
    expect(
      archiveGapTaskVisibleToUser({
        mode: "personal",
        userRole: "FINANCE",
        userId: "fin-1",
        ownerRole: "LEGAL",
        ownerUserId: "legal-1",
      })
    ).toBe(false);
  });
});
