import { describe, expect, it } from "vitest";

import { formatPhoneForDisplay } from "@/lib/phone/display";
import { stripExcelNumericSuffix } from "@/lib/utils/arabic-normalize";

function wouldCleanup(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return stripExcelNumericSuffix(value) !== value.trim();
}

describe("cleanup-excel-phone-suffixes logic", () => {
  it("detects values that need cleanup", () => {
    expect(wouldCleanup("96599034830.0")).toBe(true);
    expect(wouldCleanup("01001234567")).toBe(false);
  });

  it("reports dry-run target value", () => {
    expect(formatPhoneForDisplay("96599034830.0")).toBe("96599034830");
  });
});