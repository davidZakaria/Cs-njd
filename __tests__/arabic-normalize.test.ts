import { describe, it, expect } from "vitest";
import {
  normalizeArabic,
  splitMergedOwnerNames,
  isMergedOwnerName,
  extractPrimaryOwnerName,
  extractCoOwnerName,
  namesMatch,
  anyNameMatches,
  normalizePhone,
  phonesMatch,
  normalizeNationalId,
  nationalIdsMatch,
} from "@/lib/utils/arabic-normalize";

describe("Arabic Normalize Utils", () => {
  describe("normalizeArabic", () => {
    it("unifies alef variants (أ إ آ → ا)", () => {
      expect(normalizeArabic("أحمد")).toBe(normalizeArabic("احمد"));
      expect(normalizeArabic("إبراهيم")).toBe(normalizeArabic("ابراهيم"));
      expect(normalizeArabic("آمال")).toBe(normalizeArabic("امال"));
    });

    it("unifies ta marbuta and ha (ة → ه)", () => {
      expect(normalizeArabic("فاطمة")).toBe(normalizeArabic("فاطمه"));
      expect(normalizeArabic("سارة")).toBe(normalizeArabic("ساره"));
    });

    it("unifies alef maqsura and ya (ى → ي)", () => {
      expect(normalizeArabic("مصطفى")).toBe(normalizeArabic("مصطفي"));
      expect(normalizeArabic("هدى")).toBe(normalizeArabic("هدي"));
    });

    it("strips whitespace for comparison", () => {
      expect(normalizeArabic("نصر الله")).toBe(normalizeArabic("نصرالله"));
      expect(normalizeArabic("عبد الرحمن")).toBe(normalizeArabic("عبدالرحمن"));
    });

    it("handles empty/null input", () => {
      expect(normalizeArabic("")).toBe("");
      expect(normalizeArabic(null as unknown as string)).toBe("");
    });
  });

  describe("splitMergedOwnerNames", () => {
    it("splits Arabic names with /", () => {
      const names = splitMergedOwnerNames("يوسف شنودة / مريم ماهر");
      expect(names).toEqual(["يوسف شنودة", "مريم ماهر"]);
    });

    it("splits English names with /", () => {
      const names = splitMergedOwnerNames("Joseph Shenouda / Mariam Maher");
      expect(names).toEqual(["Joseph Shenouda", "Mariam Maher"]);
    });

    it("handles single name (no /)", () => {
      const names = splitMergedOwnerNames("أحمد محمد");
      expect(names).toEqual(["أحمد محمد"]);
    });

    it("handles multiple slashes", () => {
      const names = splitMergedOwnerNames("A / B / C");
      expect(names).toEqual(["A", "B", "C"]);
    });

    it("handles empty input", () => {
      expect(splitMergedOwnerNames("")).toEqual([]);
      expect(splitMergedOwnerNames(null as unknown as string)).toEqual([]);
    });
  });

  describe("isMergedOwnerName", () => {
    it("returns true for names with /", () => {
      expect(isMergedOwnerName("يوسف شنودة / مريم ماهر")).toBe(true);
    });

    it("returns false for single names", () => {
      expect(isMergedOwnerName("أحمد محمد")).toBe(false);
    });
  });

  describe("extractPrimaryOwnerName", () => {
    it("extracts first name from merged string", () => {
      expect(extractPrimaryOwnerName("يوسف شنودة / مريم ماهر")).toBe("يوسف شنودة");
    });

    it("returns full name if not merged", () => {
      expect(extractPrimaryOwnerName("أحمد محمد")).toBe("أحمد محمد");
    });
  });

  describe("extractCoOwnerName", () => {
    it("extracts second name from merged string", () => {
      expect(extractCoOwnerName("يوسف شنودة / مريم ماهر")).toBe("مريم ماهر");
    });

    it("returns null if not merged", () => {
      expect(extractCoOwnerName("أحمد محمد")).toBe(null);
    });
  });

  describe("namesMatch", () => {
    it("matches identical Arabic names", () => {
      expect(namesMatch("أحمد محمد", "أحمد محمد")).toBe(true);
    });

    it("matches names with different alef variants", () => {
      expect(namesMatch("أحمد", "احمد")).toBe(true);
      expect(namesMatch("إبراهيم", "ابراهيم")).toBe(true);
    });

    it("matches names with space variations", () => {
      expect(namesMatch("نصر الله", "نصرالله")).toBe(true);
      expect(namesMatch("عبد الرحمن", "عبدالرحمن")).toBe(true);
    });

    it("matches names with ta marbuta/ha variations", () => {
      expect(namesMatch("فاطمة", "فاطمه")).toBe(true);
    });

    it("does not match different names", () => {
      expect(namesMatch("أحمد", "محمد")).toBe(false);
    });
  });

  describe("anyNameMatches", () => {
    it("returns true if any name matches", () => {
      expect(anyNameMatches(
        ["أحمد", "محمد"],
        ["سارة", "احمد"]
      )).toBe(true);
    });

    it("returns false if no names match", () => {
      expect(anyNameMatches(
        ["أحمد", "محمد"],
        ["سارة", "فاطمة"]
      )).toBe(false);
    });
  });

  describe("normalizePhone", () => {
    it("removes non-digits", () => {
      expect(normalizePhone("010-1234-5678")).toBe("1012345678");
      expect(normalizePhone("+20 10 1234 5678")).toBe("1012345678");
    });

    it("removes Egypt country code prefixes", () => {
      expect(normalizePhone("00201012345678")).toBe("1012345678");
      expect(normalizePhone("+201012345678")).toBe("1012345678");
      expect(normalizePhone("201012345678")).toBe("1012345678");
      expect(normalizePhone("01012345678")).toBe("1012345678");
    });

    it("handles empty/null input", () => {
      expect(normalizePhone("")).toBe("");
      expect(normalizePhone(null)).toBe("");
      expect(normalizePhone(undefined)).toBe("");
    });
  });

  describe("phonesMatch", () => {
    it("matches identical normalized phones", () => {
      expect(phonesMatch("01012345678", "01012345678")).toBe(true);
    });

    it("matches phones with different formats", () => {
      expect(phonesMatch("+20 10 1234 5678", "01012345678")).toBe(true);
      expect(phonesMatch("00201012345678", "1012345678")).toBe(true);
    });

    it("handles suffix matching", () => {
      expect(phonesMatch("1234567", "01012345678")).toBe(false);
    });

    it("does not match different phones", () => {
      expect(phonesMatch("01012345678", "01098765432")).toBe(false);
    });

    it("returns false for empty phones", () => {
      expect(phonesMatch("", "01012345678")).toBe(false);
      expect(phonesMatch("01012345678", "")).toBe(false);
    });
  });

  describe("normalizeNationalId", () => {
    it("removes non-digits", () => {
      expect(normalizeNationalId("299-1234-5678-901")).toBe("29912345678901");
    });

    it("handles empty/null input", () => {
      expect(normalizeNationalId("")).toBe("");
      expect(normalizeNationalId(null)).toBe("");
      expect(normalizeNationalId(undefined)).toBe("");
    });
  });

  describe("nationalIdsMatch", () => {
    it("matches identical IDs", () => {
      expect(nationalIdsMatch("29912345678901", "29912345678901")).toBe(true);
    });

    it("matches IDs with different formats", () => {
      expect(nationalIdsMatch("299-1234-5678-901", "29912345678901")).toBe(true);
    });

    it("does not match different IDs", () => {
      expect(nationalIdsMatch("29912345678901", "28812345678901")).toBe(false);
    });
  });
});
