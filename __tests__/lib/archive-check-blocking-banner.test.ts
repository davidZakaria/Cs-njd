import { describe, expect, it } from "vitest";

import { mergeUnitCycleBlockerBanner } from "@/lib/archive-check/blocking-banner";
import { OPERATIONS_PROGRESS_ITEM } from "@/lib/operations/operations-progress";

describe("archive check cycle blocker banner", () => {
  it("dedupes multiple gap tasks under one archive check request", () => {
    const entries = mergeUnitCycleBlockerBanner({
      openRequests: [
        {
          id: "req-1",
          type: "ARCHIVE_CHECK",
          status: "PENDING",
          unitCycleStageKey: "LEGAL_HANDOVER",
        },
      ],
      openGapTasks: [
        {
          id: "gap-1",
          unitRequestId: "req-1",
          itemKey: OPERATIONS_PROGRESS_ITEM.preliminaryContract,
          unitCycleStageKey: "LEGAL_HANDOVER",
        },
        {
          id: "gap-2",
          unitRequestId: "req-1",
          itemKey: OPERATIONS_PROGRESS_ITEM.finalContract,
          unitCycleStageKey: "LEGAL_HANDOVER",
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.requestId).toBe("req-1");
    expect(entries[0]?.gapItemKeys).toEqual([
      OPERATIONS_PROGRESS_ITEM.finalContract,
      OPERATIONS_PROGRESS_ITEM.preliminaryContract,
    ]);
  });

  it("lists gap-only blockers when no open request row is returned for the unit", () => {
    const entries = mergeUnitCycleBlockerBanner({
      openRequests: [],
      openGapTasks: [
        {
          id: "gap-1",
          unitRequestId: "req-9",
          itemKey: OPERATIONS_PROGRESS_ITEM.finishingFinancials,
          unitCycleStageKey: "FINANCE",
        },
      ],
    });

    expect(entries).toEqual([
      {
        requestId: "req-9",
        type: "ARCHIVE_CHECK",
        gapItemKeys: [OPERATIONS_PROGRESS_ITEM.finishingFinancials],
      },
    ]);
  });
});
