import { describe, expect, it } from "vitest";

import { buildMasterSheetCases } from "@/lib/import/master-cases";

describe("buildMasterSheetCases", () => {
  it("skips FEEDBACK_HISTORY when text matches active customer service note", () => {
    const cases = buildMasterSheetCases({
      customerServiceRaw: "نفس الملاحظة",
      feedbackOldRaw: "نفس الملاحظة",
    });
    expect(cases).toHaveLength(1);
    expect(cases[0].category).toBe("CUSTOMER_SERVICE");
  });

  it("still imports distinct feedback history", () => {
    const cases = buildMasterSheetCases({
      customerServiceRaw: "ملاحظة حالية",
      feedbackOldRaw: "ملاحظة قديمة",
    });
    expect(cases.some((c) => c.category === "FEEDBACK_HISTORY")).toBe(true);
  });
});