import { describe, it, expect } from "vitest";
import { parseLegacyNumber } from "@/lib/import/numbers";

describe("parseLegacyNumber", () => {
  describe("null/undefined handling", () => {
    it("returns null for null", () => {
      expect(parseLegacyNumber(null)).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(parseLegacyNumber(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseLegacyNumber("")).toBeNull();
    });

    it("returns null for whitespace only", () => {
      expect(parseLegacyNumber("   ")).toBeNull();
    });
  });

  describe("numeric input", () => {
    it("passes through numbers", () => {
      expect(parseLegacyNumber(123)).toBe(123);
      expect(parseLegacyNumber(123.45)).toBe(123.45);
    });

    it("returns null for NaN", () => {
      expect(parseLegacyNumber(NaN)).toBeNull();
    });

    it("handles zero", () => {
      expect(parseLegacyNumber(0)).toBe(0);
    });
  });

  describe("string parsing", () => {
    it("parses simple numeric strings", () => {
      expect(parseLegacyNumber("123")).toBe(123);
      expect(parseLegacyNumber("123.45")).toBe(123.45);
    });

    it("handles comma-separated thousands", () => {
      expect(parseLegacyNumber("1,234")).toBe(1234);
      expect(parseLegacyNumber("1,234,567")).toBe(1234567);
    });

    it("strips currency symbols", () => {
      expect(parseLegacyNumber("EGP 1000")).toBe(1000);
      expect(parseLegacyNumber("$500")).toBe(500);
      expect(parseLegacyNumber("€250")).toBe(250);
      expect(parseLegacyNumber("£100")).toBe(100);
      expect(parseLegacyNumber("جE 1500")).toBe(1500);
    });
  });

  describe("Arabic text handling", () => {
    it("extracts ASCII numbers from Arabic text", () => {
      expect(parseLegacyNumber("5 ألف")).toBe(5);
      expect(parseLegacyNumber("مبلغ 1000 جنيه")).toBe(1000);
    });

    it("strips Arabic currency indicators", () => {
      expect(parseLegacyNumber("ج 500")).toBe(500);
    });
  });

  describe("edge cases", () => {
    it("handles leading/trailing whitespace", () => {
      expect(parseLegacyNumber("  123  ")).toBe(123);
    });

    it("handles mixed formats", () => {
      expect(parseLegacyNumber("EGP 1,234.56")).toBe(1234.56);
    });

    it("returns null for non-numeric strings", () => {
      expect(parseLegacyNumber("abc")).toBeNull();
      expect(parseLegacyNumber("not a number")).toBeNull();
    });
  });
});
