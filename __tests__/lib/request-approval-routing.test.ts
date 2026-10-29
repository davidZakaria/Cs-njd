import { describe, expect, it } from "vitest";

import {
  getApprovalPathForType,
  normalizeApprovalPath,
} from "@/lib/requests/approval-paths";
import {
  ORG_HAS_FINANCE_STAFF_ROLE,
  ORG_HAS_LEGAL_STAFF_ROLE,
  resolveApproverKindToRole,
} from "@/lib/requests/approver-roles";
import {
  advanceAfterApproval,
  buildSubmitState,
  pathStepCount,
} from "@/lib/requests/workflow-helpers";
import { unitCycleStageForRequestType } from "@/lib/requests/stage-mapping";

describe("request approval paths", () => {
  it("maps contract amendment to Legal then Management", () => {
    expect(getApprovalPathForType("CONTRACT_ISSUE_OR_AMENDMENT")).toEqual([
      "LEGAL",
      "MANAGEMENT",
    ]);
  });

  it("maps payment plan change to Finance only", () => {
    expect(getApprovalPathForType("PAYMENT_PLAN_CHANGE")).toEqual(["FINANCE"]);
  });

  it("maps site visit to CS agent", () => {
    expect(getApprovalPathForType("SITE_VISIT")).toEqual(["CS_AGENT"]);
  });

  it("resolves Legal and Finance to Management until dedicated roles exist", () => {
    expect(ORG_HAS_LEGAL_STAFF_ROLE).toBe(false);
    expect(ORG_HAS_FINANCE_STAFF_ROLE).toBe(false);
    expect(resolveApproverKindToRole("LEGAL")).toBe("MANAGEMENT");
    expect(resolveApproverKindToRole("FINANCE")).toBe("MANAGEMENT");
  });

  it("dedupes consecutive identical steps after role resolution", () => {
    const normalized = normalizeApprovalPath(["FINANCE", "MANAGEMENT"]);
    expect(normalized).toEqual(["FINANCE", "MANAGEMENT"]);
    expect(pathStepCount("REFUND")).toBe(2);
  });

  it("advances multi-step refund through Finance then Management", () => {
    const submit = buildSubmitState("REFUND");
    expect(submit.currentApproverKind).toBe("FINANCE");

    const mid = advanceAfterApproval({
      type: "REFUND",
      currentStepIndex: 0,
    });
    expect(mid.done).toBe(false);
    expect(mid.nextApproverKind).toBe("MANAGEMENT");

    const done = advanceAfterApproval({
      type: "REFUND",
      currentStepIndex: mid.nextStepIndex,
    });
    expect(done.done).toBe(true);
  });

  it("links request types to unit cycle stages", () => {
    expect(unitCycleStageForRequestType("SITE_VISIT")).toBe("ENGINEERING");
    expect(unitCycleStageForRequestType("HANDOVER_APPOINTMENT")).toBe(
      "LEGAL_HANDOVER"
    );
  });
});
