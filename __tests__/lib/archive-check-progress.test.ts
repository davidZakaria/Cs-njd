import { describe, expect, it } from "vitest";

import {
  buildArchiveCheckProgressItems,
  summarizeArchiveCheckProgress,
} from "@/lib/archive-check/progress";
import { OPERATIONS_PROGRESS_ITEM } from "@/lib/operations/operations-progress";

describe("archive check progress", () => {
  it("uses gap task ownerRole for being-fixed department label", () => {
    const items = buildArchiveCheckProgressItems({
      items: [
        {
          itemKey: OPERATIONS_PROGRESS_ITEM.finishingFinancials,
          status: "MISSING",
        },
      ],
      gapTasks: [
        {
          itemKey: OPERATIONS_PROGRESS_ITEM.finishingFinancials,
          status: "OPEN",
          ownerRole: "FINANCE",
        },
      ],
    });

    expect(items[0]?.displayStatus).toBe("being_fixed");
    expect(items[0]?.fixingDepartment).toBe("FINANCE");
  });

  it("shows neutral not-checked before operations marks items", () => {
    const items = buildArchiveCheckProgressItems({
      items: [
        {
          itemKey: OPERATIONS_PROGRESS_ITEM.preliminaryContract,
          status: "PENDING",
        },
      ],
      gapTasks: [],
    });

    expect(items[0]?.displayStatus).toBe("not_checked");
  });

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
          ownerRole: "LEGAL",
        },
      ],
    });

    const summary = summarizeArchiveCheckProgress(items);
    expect(summary.doneCount).toBe(1);
    expect(summary.totalCount).toBe(2);
    expect(items[1]?.fixingDepartment).toBe("LEGAL");
  });
});
