import { describe, expect, it } from "vitest";

import {
  buildStageChecklist,
  deriveCompletedStageKeys,
  isStageChecklistComplete,
  resolveActiveStageKey,
} from "@/lib/operations/operations-progress";
import type { UnitOperationsSnapshot } from "@/lib/operations/operations-progress";
import {
  canCompleteStage,
  isStageOverdue,
  nextStageKey,
} from "@/lib/unit-cycle/stage-rules";

const emptySnapshot: UnitOperationsSnapshot = {
  unit: { contractPricePerMeter: null, area: 100 },
  contractWorkflow: null,
  finishing: null,
  engineeringCsApproved: false,
};

describe("operations-progress", () => {
  it("marks contract checklist incomplete without workflow data", () => {
    const checklist = buildStageChecklist("CONTRACT", emptySnapshot);
    expect(checklist.every((item) => item.passed)).toBe(false);
  });

  it("derives sequential completed stages", () => {
    const snapshot: UnitOperationsSnapshot = {
      ...emptySnapshot,
      contractWorkflow: {
        contractDate: new Date("2024-01-01"),
        deliveryDate: new Date("2025-01-01"),
        hasPreliminarySaleContract: true,
        hasFinalSaleContract: false,
        signedContractFile: "file.pdf",
        hasPaidFees: true,
        hasSignedProtocol: false,
        hasSignedExtension: false,
        papersReceived: false,
        handoverStatus: "PENDING",
        isLegallyBlocked: false,
        paperHandoverOriginalProtocol: false,
        paperHandoverKeyReceived: false,
      },
      finishing: {
        phases: [],
        phase: "NOT_STARTED",
        packageType: "CORE_AND_SHELL",
        doorFees: 0,
        aluminumFees: 0,
        customModifications: null,
        modificationsCompleted: true,
        totalFinishingPrice: null,
        pricePerMeter: null,
      },
    };

    const completed = deriveCompletedStageKeys(snapshot);
    expect(completed).toEqual(["CONTRACT", "FINANCE"]);
    expect(isStageChecklistComplete("ENGINEERING", snapshot)).toBe(false);
  });
});

describe("unit-cycle stage rules", () => {
  it("gates completion on checklist and status", () => {
    expect(
      canCompleteStage("CONTRACT", "IN_PROGRESS", emptySnapshot)
    ).toBe(false);
    expect(canCompleteStage("CONTRACT", "DONE", emptySnapshot)).toBe(false);
  });

  it("returns next stage in order", () => {
    expect(nextStageKey("CONTRACT")).toBe("FINANCE");
    expect(nextStageKey("LEGAL_HANDOVER")).toBeNull();
  });

  it("detects overdue in-progress stages", () => {
    expect(
      isStageOverdue({
        status: "IN_PROGRESS",
        deadlineAt: new Date("2020-01-01"),
        now: new Date("2026-01-01"),
      })
    ).toBe(true);
    expect(
      isStageOverdue({
        status: "DONE",
        deadlineAt: new Date("2020-01-01"),
      })
    ).toBe(false);
  });

  it("resolves active stage as first not done", () => {
    expect(
      resolveActiveStageKey([
        { stageKey: "CONTRACT", status: "DONE" },
        { stageKey: "FINANCE", status: "IN_PROGRESS" },
        { stageKey: "ENGINEERING", status: "NOT_STARTED" },
        { stageKey: "LEGAL_HANDOVER", status: "NOT_STARTED" },
      ])
    ).toBe("FINANCE");
  });
});
