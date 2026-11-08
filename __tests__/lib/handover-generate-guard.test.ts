import { describe, expect, it } from "vitest";

import { formatOfficialHandoverMissingToken } from "@/lib/official-documents/handover/constants";
import { formatHandoverGenerateBlockedMessage } from "@/lib/official-documents/handover/generate-guard";

describe("formatHandoverGenerateBlockedMessage", () => {
  it("returns null when no merge placeholders remain", () => {
    expect(formatHandoverGenerateBlockedMessage("أولاً: بيانات المستلم\n\nثانياً: الوحدة", "ar")).toBeNull();
  });

  it("returns localized message listing missing fields", () => {
    const body = `text ${formatOfficialHandoverMissingToken("owner1_phone1")} more`;
    const en = formatHandoverGenerateBlockedMessage(body, "en");
    expect(en).toMatch(/Cannot generate PDF/);
    expect(en).toMatch(/Primary owner phone/);
    const ar = formatHandoverGenerateBlockedMessage(body, "ar");
    expect(ar).toMatch(/لا يمكن إنشاء PDF/);
    expect(ar).toMatch(/هاتف المالك الأساسي/);
  });
});
