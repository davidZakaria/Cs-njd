import { describe, expect, it } from "vitest";

import { isCommunityCallLog } from "@/lib/services/community-tracker";

describe("isCommunityCallLog", () => {
  it("counts FEEDBACK_HISTORY from community agents without emoji", () => {
    expect(
      isCommunityCallLog("FEEDBACK_HISTORY", "اتصلت بالعميل", {
        fromCommunityManagementCreator: true,
      })
    ).toBe(true);
  });

  it("does not treat plain FEEDBACK_HISTORY imports as calls", () => {
    expect(
      isCommunityCallLog("FEEDBACK_HISTORY", "مهندس: تم تحديث الموقع")
    ).toBe(false);
  });

  it("still recognizes emoji or server-tagged legacy rows", () => {
    expect(isCommunityCallLog("FEEDBACK_HISTORY", "📞 answered")).toBe(true);
  });
});