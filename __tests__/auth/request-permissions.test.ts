import { describe, expect, it } from "vitest";

import { canAccessRequestsDashboard } from "@/lib/auth/role-permissions";
import {
  canCreateUnitRequest,
  canViewUnitRequest,
  userCanApproveAtCurrentStep,
} from "@/lib/requests/permissions";
import { isOperationsAnApprover } from "@/lib/requests/approver-roles";
import { getApprovalPathForType } from "@/lib/requests/approval-paths";

describe("request permissions", () => {
  it("allows CS agents and management to create requests", () => {
    expect(canCreateUnitRequest("CS_AGENT")).toBe(true);
    expect(canCreateUnitRequest("MANAGEMENT")).toBe(true);
    expect(canCreateUnitRequest("OPERATIONS")).toBe(false);
    expect(canCreateUnitRequest("ENGINEER")).toBe(false);
  });

  it("denies operations dashboard access", () => {
    expect(canAccessRequestsDashboard("OPERATIONS")).toBe(false);
    expect(canAccessRequestsDashboard("CS_AGENT")).toBe(true);
    expect(canAccessRequestsDashboard("COMMUNITY_MANAGEMENT")).toBe(true);
  });

  it("never treats Operations as an approver step", () => {
    expect(isOperationsAnApprover()).toBe(false);
    for (const type of [
      "CONTRACT_ISSUE_OR_AMENDMENT",
      "UNIT_SWAP",
      "REFUND",
    ] as const) {
      expect(getApprovalPathForType(type)).not.toContain("OPERATIONS" as never);
    }
  });

  it("lets management approve Finance-mapped pending requests", () => {
    expect(
      userCanApproveAtCurrentStep({
        role: "MANAGEMENT",
        userId: "mgr",
        request: {
          type: "PAYMENT_PLAN_CHANGE",
          status: "PENDING",
          currentStepIndex: 0,
          currentApproverKind: "FINANCE",
        },
        unitAgentId: "agent-1",
      })
    ).toBe(true);
  });

  it("lets community management view handover appointments only", () => {
    expect(
      canViewUnitRequest({
        role: "COMMUNITY_MANAGEMENT",
        userId: "cm",
        request: {
          requestedById: "other",
          type: "HANDOVER_APPOINTMENT",
          status: "PENDING",
          currentStepIndex: 0,
          currentApproverKind: "CS_AGENT",
        },
        unitAgentId: null,
      })
    ).toBe(true);

    expect(
      canViewUnitRequest({
        role: "COMMUNITY_MANAGEMENT",
        userId: "cm",
        request: {
          requestedById: "other",
          type: "REFUND",
          status: "PENDING",
          currentStepIndex: 0,
          currentApproverKind: "FINANCE",
        },
        unitAgentId: null,
      })
    ).toBe(false);
  });
});
