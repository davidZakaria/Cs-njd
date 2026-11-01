import { describe, expect, it } from "vitest";

import {
  blockingRequestsForStage,
  requestBlocksUnitCycleStage,
  stageIsBlockedByOpenRequests,
} from "@/lib/unit-cycle/stage-request-blocking";

describe("unit cycle request blocking", () => {
  it("does not block when cycle disabled", () => {
    expect(
      requestBlocksUnitCycleStage({
        unitCycleEnabled: false,
        stageKey: "FINANCE",
        request: {
          status: "PENDING",
          type: "REFUND",
          unitCycleStageKey: "FINANCE",
        },
      })
    ).toBe(false);
  });

  it("blocks finance stage for open refund requests on enabled projects", () => {
    expect(
      requestBlocksUnitCycleStage({
        unitCycleEnabled: true,
        stageKey: "FINANCE",
        request: {
          status: "PENDING",
          type: "REFUND",
          unitCycleStageKey: "FINANCE",
        },
      })
    ).toBe(true);
  });

  it("ignores unit swap for stage blocking", () => {
    expect(
      requestBlocksUnitCycleStage({
        unitCycleEnabled: true,
        stageKey: "CONTRACT",
        request: {
          status: "PENDING",
          type: "UNIT_SWAP",
          unitCycleStageKey: null,
        },
      })
    ).toBe(false);
  });

  it("lists blockers for active stage", () => {
    const blockers = blockingRequestsForStage(
      "ENGINEERING",
      [
        {
          id: "a",
          type: "SITE_VISIT",
          status: "DRAFT",
          unitCycleStageKey: "ENGINEERING",
        },
        {
          id: "b",
          type: "REFUND",
          status: "PENDING",
          unitCycleStageKey: "FINANCE",
        },
      ],
      true
    );
    expect(blockers.map((row) => row.id)).toEqual(["a"]);
    expect(
      stageIsBlockedByOpenRequests({
        unitCycleEnabled: true,
        stageKey: "ENGINEERING",
        openRequests: blockers,
      })
    ).toBe(true);
  });
});
