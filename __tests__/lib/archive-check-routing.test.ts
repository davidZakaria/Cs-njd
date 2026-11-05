import { describe, expect, it } from "vitest";

import { OPERATIONS_PROGRESS_ITEM } from "@/lib/operations/operations-progress";
import {
  resolveGapOwnerRoleForItem,
  unitCycleStageForGapItem,
} from "@/lib/archive-check/routing";

describe("archive check gap routing", () => {
  it("routes contract items to Legal when staff exists", () => {
    expect(
      resolveGapOwnerRoleForItem(
        OPERATIONS_PROGRESS_ITEM.preliminaryContract,
        { hasLegalStaff: true, hasFinanceStaff: true }
      )
    ).toBe("LEGAL");
  });

  it("falls back contract gaps to Management without Legal staff", () => {
    expect(
      resolveGapOwnerRoleForItem(
        OPERATIONS_PROGRESS_ITEM.finalContract,
        { hasLegalStaff: false, hasFinanceStaff: true }
      )
    ).toBe("MANAGEMENT");
  });

  it("routes finishing financial gaps to Finance when staff exists", () => {
    expect(
      resolveGapOwnerRoleForItem(
        OPERATIONS_PROGRESS_ITEM.finishingFinancials,
        { hasLegalStaff: true, hasFinanceStaff: true }
      )
    ).toBe("FINANCE");
  });

  it("maps finance gaps to FINANCE cycle stage and legal gaps to LEGAL_HANDOVER", () => {
    expect(
      unitCycleStageForGapItem(OPERATIONS_PROGRESS_ITEM.finishingContract)
    ).toBe("FINANCE");
    expect(
      unitCycleStageForGapItem(OPERATIONS_PROGRESS_ITEM.handoverRecord)
    ).toBe("LEGAL_HANDOVER");
  });
});
