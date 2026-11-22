import { describe, expect, it } from "vitest";

import {
  digitsToArabicIndic,
  digitsToWestern,
  formatLocaleInteger,
  localeAgnosticIncludes,
  searchDigitVariants,
} from "@/lib/format/locale-display";

describe("locale display", () => {
  it("formats Arabic integers with Arabic-Indic digits", () => {
    expect(formatLocaleInteger(42, "ar")).toMatch(/[٠-٩]/);
    expect(formatLocaleInteger(42, "en")).toBe("42");
  });

  it("converts digits both ways", () => {
    expect(digitsToWestern("١٠٠")).toBe("100");
    expect(digitsToArabicIndic("100")).toBe("١٠٠");
  });

  it("expands search digit variants", () => {
    const variants = searchDigitVariants("٩٦٥");
    expect(variants).toContain("٩٦٥");
    expect(variants).toContain("965");
  });

  it("localeAgnosticIncludes matches either digit form", () => {
    expect(localeAgnosticIncludes("unit 96599034830", "٩٦٥")).toBe(true);
    expect(localeAgnosticIncludes("unit 96599034830", "965")).toBe(true);
  });
});