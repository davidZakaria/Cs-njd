import { describe, it, expect } from "vitest";
import { parseLegacyDate } from "@/lib/import/dates";

describe("parseLegacyDate", () => {
  describe("null/undefined handling", () => {
    it("returns null for null", () => {
      expect(parseLegacyDate(null)).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(parseLegacyDate(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseLegacyDate("")).toBeNull();
    });
  });

  describe("Date object input", () => {
    it("returns valid Date objects as-is", () => {
      const date = new Date("2024-06-15");
      const result = parseLegacyDate(date);
      expect(result).toEqual(date);
    });

    it("returns null for invalid Date objects", () => {
      const invalidDate = new Date("invalid");
      expect(parseLegacyDate(invalidDate)).toBeNull();
    });
  });

  describe("Excel serial number parsing", () => {
    it("parses Excel serial number (numeric)", () => {
      const serial = 45000;
      const result = parseLegacyDate(serial);
      expect(result).toBeInstanceOf(Date);
      expect(result).not.toBeNull();
    });

    it("parses Excel serial number (string)", () => {
      const result = parseLegacyDate("45000");
      expect(result).toBeInstanceOf(Date);
    });

    it("handles decimal serial numbers", () => {
      const result = parseLegacyDate("45000.5");
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("date format parsing", () => {
    it("parses yyyy-MM-dd format", () => {
      const result = parseLegacyDate("2024-06-15");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(5);
      expect(result?.getDate()).toBe(15);
    });

    it("parses d/M/yyyy format", () => {
      const result = parseLegacyDate("15/6/2024");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(5);
      expect(result?.getDate()).toBe(15);
    });

    it("parses dd/MM/yyyy format", () => {
      const result = parseLegacyDate("15/06/2024");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });

    it("parses M/d/yyyy format (US style)", () => {
      const result = parseLegacyDate("6/15/2024");
      expect(result).toBeInstanceOf(Date);
    });

    it("parses d-M-yyyy format", () => {
      const result = parseLegacyDate("15-6-2024");
      expect(result).toBeInstanceOf(Date);
    });

    it("parses dd-MM-yyyy format", () => {
      const result = parseLegacyDate("15-06-2024");
      expect(result).toBeInstanceOf(Date);
    });

    it("parses yyyy/MM/dd format", () => {
      const result = parseLegacyDate("2024/06/15");
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("edge cases", () => {
    it("returns null for invalid date strings", () => {
      expect(parseLegacyDate("not a date")).toBeNull();
      expect(parseLegacyDate("abc")).toBeNull();
    });

    it("handles whitespace-only strings", () => {
      expect(parseLegacyDate("   ")).toBeNull();
    });

    it("trims input strings", () => {
      const result = parseLegacyDate("  2024-06-15  ");
      expect(result).toBeInstanceOf(Date);
    });
  });
});
