import { describe, expect, it } from "vitest";

import {
  getApprovalPathForType,
  normalizeApprovalPath,
} from "@/lib/requests/approval-paths";
import {
  resolveApproverKindToRole,
  rolesThatCanActOnApproverKind,
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

  it("resolves Legal and Finance to dedicated roles when staff exists", () => {
    expect(
      resolveApproverKindToRole("LEGAL", { hasLegalStaff: true, hasFinanceStaff: true })
    ).toBe("LEGAL");
    expect(
      resolveApproverKindToRole("FINANCE", { hasLegalStaff: true, hasFinanceStaff: true })
    ).toBe("FINANCE");
  });

  it("falls back Legal and Finance to Management when no dedicated staff", () => {
    expect(
      resolveApproverKindToRole("LEGAL", { hasLegalStaff: false, hasFinanceStaff: false })
    ).toBe("MANAGEMENT");
    expect(
      resolveApproverKindToRole("FINANCE", { hasLegalStaff: false, hasFinanceStaff: false })
    ).toBe("MANAGEMENT");
  });

  it("limits Legal inbox to Legal when staff exists", () => {
    expect(
      rolesThatCanActOnApproverKind("LEGAL", {
        hasLegalStaff: true,
        hasFinanceStaff: true,
      })
    ).toEqual(["LEGAL", "SUPER_ADMIN"]);
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

  it("links request types to unit cycle stages for pilot blocking", () => {
    expect(unitCycleStageForRequestType("SITE_VISIT")).toBe("ENGINEERING");
    expect(unitCycleStageForRequestType("HANDOVER_APPOINTMENT")).toBe(
      "LEGAL_HANDOVER"
    );
    expect(unitCycleStageForRequestType("CONTRACT_ISSUE_OR_AMENDMENT")).toBe(
      "LEGAL_HANDOVER"
    );
    expect(unitCycleStageForRequestType("UNIT_SWAP")).toBeNull();
    expect(unitCycleStageForRequestType("ARCHIVE_CHECK")).toBe("LEGAL_HANDOVER");
    expect(getApprovalPathForType("ARCHIVE_CHECK")).toEqual(["OPERATIONS"]);
  });
});
