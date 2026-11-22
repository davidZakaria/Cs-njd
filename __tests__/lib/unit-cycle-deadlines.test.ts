import { describe, expect, it } from "vitest";

import type { UnitOperationsSnapshot } from "@/lib/operations/operations-progress";
import {
  classifyRetroactiveUnitCycleDeadline,
  computeForwardStageDeadline,
  computeStageDeadline,
  resolveLegacyStageAnchor,
  resolveStageActivationStartedAt,
} from "@/lib/unit-cycle/deadlines";

const snapshot: UnitOperationsSnapshot = {
  unit: { contractPricePerMeter: null, area: 100 },
  contractWorkflow: {
    contractDate: new Date("2020-01-15T00:00:00.000Z"),
    deliveryDate: new Date("2025-01-01T00:00:00.000Z"),
    hasPreliminarySaleContract: true,
    hasFinalSaleContract: false,
    signedContractFile: null,
    hasPaidFees: false,
    hasSignedProtocol: false,
    hasSignedExtension: false,
    papersReceived: false,
    handoverStatus: "PENDING",
    isLegallyBlocked: false,
    paperHandoverOriginalProtocol: false,
    paperHandoverKeyReceived: false,
  },
  finishing: null,
  engineeringReadinessSignedOff: false,
};

describe("unit-cycle deadlines", () => {
  it("computes forward deadlines from legacy contract anchors", () => {
    const now = new Date("2026-03-01T12:00:00.000Z");
  const anchor = resolveLegacyStageAnchor("CONTRACT", snapshot);
    expect(anchor?.toISOString()).toBe("2020-01-15T00:00:00.000Z");

    const startedAt = resolveStageActivationStartedAt({
      stageKey: "CONTRACT",
      snapshot,
      now,
    });
    expect(startedAt.toISOString()).toBe("2020-01-15T00:00:00.000Z");

    const naive = computeStageDeadline(startedAt, 5);
    expect(naive.getTime()).toBeLessThan(now.getTime());

    const forward = computeForwardStageDeadline(startedAt, 5, now);
    expect(forward.getTime()).toBeGreaterThan(now.getTime());
    expect(forward.toISOString()).toBe("2026-03-06T12:00:00.000Z");
  });

  it("never yields a deadline in the past at creation", () => {
    const anchors = [
      new Date("2020-01-15T00:00:00.000Z"),
      new Date("2024-06-01T10:00:00.000Z"),
      new Date("2026-03-01T12:00:00.000Z"),
    ];
    const now = new Date("2026-03-01T12:00:00.000Z");

    for (const startedAt of anchors) {
      for (const days of [1, 5, 7, 14, 90]) {
        const deadline = computeForwardStageDeadline(startedAt, days, now);
        expect(deadline.getTime()).toBeGreaterThan(now.getTime());
      }
    }
  });

  it("classifies retroactive deadline patterns", () => {
    const cycleCreated = new Date("2024-06-01T00:00:00.000Z");
    const started = new Date("2024-06-01T10:00:00.000Z");
    const now = new Date("2026-03-01T00:00:00.000Z");

    expect(
      classifyRetroactiveUnitCycleDeadline({
        status: "IN_PROGRESS",
        startedAt: started,
        deadlineAt: new Date("2024-05-01T00:00:00.000Z"),
        unitCycleCreatedAt: cycleCreated,
        now,
      })
    ).toBe("deadline_before_cycle_created");

    expect(
      classifyRetroactiveUnitCycleDeadline({
        status: "IN_PROGRESS",
        startedAt: started,
        deadlineAt: new Date("2024-06-03T00:00:00.000Z"),
        unitCycleCreatedAt: cycleCreated,
        now,
      })
    ).toBe("active_deadline_in_past");
  });
});