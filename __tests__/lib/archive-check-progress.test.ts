import { describe, expect, it } from "vitest";

import {
  buildArchiveCheckProgressItems,
  summarizeArchiveCheckProgress,
} from "@/lib/archive-check/progress";
import { OPERATIONS_PROGRESS_ITEM } from "@/lib/operations/operations-progress";
import { stageIsBlockedByArchiveGaps } from "@/lib/archive-check/stage-blocking";

describe("archive check progress", () => {
  it("summarizes done vs total for requester view", () => {
    const items = buildArchiveCheckProgressItems({
      items: [
        {
          itemKey: OPERATIONS_PROGRESS_ITEM.preliminaryContract,
          status: "FOUND",
        },
        {
          itemKey: OPERATIONS_PROGRESS_ITEM.finalContract,
          status: "MISSING",
        },
      ],
      gapTasks: [
        {
          itemKey: OPERATIONS_PROGRESS_ITEM.finalContract,
          status: "OPEN",
        },
      ],
      staff: { hasLegalStaff: true, hasFinanceStaff: true },
    });

    const summary = summarizeArchiveCheckProgress(items);
    expect(summary.doneCount).toBe(1);
    expect(summary.totalCount).toBe(2);
    expect(items[1]?.displayStatus).toBe("being_fixed");
    expect(items[1]?.fixingDepartment).toBe("LEGAL");
  });

  it("blocks unit cycle stage when open gap targets that stage", () => {
    expect(
      stageIsBlockedByArchiveGaps({
        unitCycleEnabled: true,
        stageKey: "FINANCE",
        openGapTasks: [
          {
            id: "gap-1",
            unitRequestId: "req-1",
            itemKey: OPERATIONS_PROGRESS_ITEM.finishingFinancials,
            unitCycleStageKey: "FINANCE",
          },
        ],
      })
    ).toBe(true);

    expect(
      stageIsBlockedByArchiveGaps({
        unitCycleEnabled: true,
        stageKey: "ENGINEERING",
        openGapTasks: [
          {
            id: "gap-1",
            unitRequestId: "req-1",
            itemKey: OPERATIONS_PROGRESS_ITEM.finishingFinancials,
            unitCycleStageKey: "FINANCE",
          },
        ],
      })
    ).toBe(false);
  });
});
