import { describe, it, expect } from "vitest";
import {
  normalizeHeader,
  normalizeProjectName,
  normalizeUnitCode,
  splitPhones,
  stripNumericSuffix,
} from "@/lib/import/sanitize";

describe("Import Sanitizers", () => {
  describe("normalizeHeader", () => {
    it("trims whitespace", () => {
      expect(normalizeHeader("  header  ")).toBe("header");
    });

    it("lowercases text", () => {
      expect(normalizeHeader("HEADER")).toBe("header");
      expect(normalizeHeader("Header Name")).toBe("header name");
    });

    it("collapses multiple spaces", () => {
      expect(normalizeHeader("header   name")).toBe("header name");
      expect(normalizeHeader("one  two   three")).toBe("one two three");
    });

    it("handles combined cases", () => {
      expect(normalizeHeader("  HEADER   NAME  ")).toBe("header name");
    });
  });

  describe("normalizeProjectName", () => {
    it("trims whitespace", () => {
      expect(normalizeProjectName("  project  ")).toBe("PROJECT");
    });

    it("uppercases text", () => {
      expect(normalizeProjectName("project")).toBe("PROJECT");
      expect(normalizeProjectName("Green Avenue")).toBe("GREEN AVENUE");
    });

    it("collapses multiple spaces", () => {
      expect(normalizeProjectName("project   name")).toBe("PROJECT NAME");
    });

    it("handles Arabic project names", () => {
      expect(normalizeProjectName("جورا")).toBe("جورا");
    });
  });

  describe("normalizeUnitCode", () => {
    it("converts number to string", () => {
      expect(normalizeUnitCode(123)).toBe("123");
    });

    it("trims whitespace", () => {
      expect(normalizeUnitCode("  A101  ")).toBe("A101");
    });

    it("strips .0 suffix from numeric strings", () => {
      expect(normalizeUnitCode("123.0")).toBe("123");
      expect(normalizeUnitCode(123.0)).toBe("123");
    });

    it("preserves non-.0 decimals", () => {
      expect(normalizeUnitCode("123.5")).toBe("123.5");
    });

    it("handles alphanumeric codes", () => {
      expect(normalizeUnitCode("A-101")).toBe("A-101");
      expect(normalizeUnitCode("B2-Floor3")).toBe("B2-Floor3");
    });
  });

  describe("splitPhones", () => {
    it("returns empty object for undefined", () => {
      expect(splitPhones(undefined)).toEqual({});
    });

    it("returns empty object for empty string", () => {
      expect(splitPhones("")).toEqual({});
    });

    it("extracts single phone", () => {
      expect(splitPhones("01234567890")).toEqual({ phone1: "01234567890" });
    });

    it("splits on hyphen", () => {
      expect(splitPhones("01234567890-09876543210")).toEqual({
        phone1: "01234567890",
        phone2: "09876543210",
      });
    });

    it("splits on forward slash", () => {
      expect(splitPhones("01234567890/09876543210")).toEqual({
        phone1: "01234567890",
        phone2: "09876543210",
      });
    });

    it("removes internal whitespace from phones", () => {
      expect(splitPhones("0123 456 7890 / 0987 654 3210")).toEqual({
        phone1: "01234567890",
        phone2: "09876543210",
      });
    });

    it("handles only first two phones", () => {
      const result = splitPhones("111-222-333");
      expect(result.phone1).toBe("111");
      expect(result.phone2).toBe("222");
    });
  });

  describe("stripNumericSuffix", () => {
    it("strips .0 suffix", () => {
      expect(stripNumericSuffix("123.0")).toBe("123");
    });

    it("preserves other decimals", () => {
      expect(stripNumericSuffix("123.5")).toBe("123.5");
    });

    it("handles non-numeric values", () => {
      expect(stripNumericSuffix("ABC.0")).toBe("ABC");
      expect(stripNumericSuffix("ABC")).toBe("ABC");
    });
  });
});
