import { describe, expect, it } from "vitest";

import {
  assessFinishingFinancialData,
  isEmptyFinishingFinancialRow,
  MAX_PLAUSIBLE_DOOR_FEES_EGP,
} from "@/lib/finishing/financial-data-quality";

describe("financial-data-quality", () => {
  it("treats all-zero rows as empty (not finance check errors)", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 0,
      doorFees: 0,
      aluminumFees: 0,
      area: 90,
    });
    expect(result.isEmpty).toBe(true);
    expect(result.showInFinanceDataCheck).toBe(false);
    expect(
      isEmptyFinishingFinancialRow({
        totalFinishingPrice: 0,
        doorFees: 0,
        aluminumFees: 0,
        area: null,
        pricePerMeter: null,
      })
    ).toBe(true);
  });

  it("flags zero total with fees in finance check", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 0,
      doorFees: 30_000,
      aluminumFees: 0,
      area: 90,
    });
    expect(result.isEmpty).toBe(false);
    expect(result.financeCheckReasons).toContain("total_zero_or_negative");
    expect(result.includeDoorInSum).toBe(true);
    expect(result.includeTotalInSum).toBe(false);
  });

  it("excludes implausible door fees from door sum but keeps valid finishing total", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 600_000,
      doorFees: 200_000,
      aluminumFees: 0,
      area: 120,
      pricePerMeter: 5_000,
    });
    expect(result.financeCheckReasons).toContain("doorFees_implausible");
    expect(result.includeTotalInSum).toBe(true);
    expect(result.includeDoorInSum).toBe(false);
    expect(result.showInFinanceDataCheck).toBe(true);
  });

  it("flags concatenated door fees and excludes bad total from finishing sum", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 3_000_037_032,
      doorFees: 3_000_037_032,
      aluminumFees: 0,
      area: 120,
    });
    expect(result.financeCheckReasons).toContain("doorFees_implausible");
    expect(result.includeTotalInSum).toBe(false);
    expect(result.includeDoorInSum).toBe(false);
  });

  it("flags sale-price-like totals via per-m² when area is known", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 16_650_000,
      doorFees: 0,
      aluminumFees: 0,
      area: 110,
      pricePerMeter: null,
    });
    expect(result.financeCheckReasons).toContain("total_per_sqm_high");
    expect(result.includeTotalInSum).toBe(false);
  });

  it("flags total mismatch vs price per meter × area", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 1_000_000,
      doorFees: 0,
      aluminumFees: 0,
      area: 100,
      pricePerMeter: 5_000,
    });
    expect(result.financeCheckReasons).toContain("total_mismatch_price_per_sqm");
    expect(result.includeTotalInSum).toBe(false);
  });

  it("flags fee-only rows where total equals door plus aluminum", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 55_000,
      doorFees: 30_000,
      aluminumFees: 25_000,
      area: 100,
      pricePerMeter: 550,
    });
    expect(result.financeCheckReasons).toContain("total_fee_only");
    expect(result.includeTotalInSum).toBe(false);
    expect(result.includeDoorInSum).toBe(true);
    expect(result.includeAluminumInSum).toBe(true);
  });

  it("includes priced without area in finishing total sum", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 800_000,
      doorFees: 0,
      aluminumFees: 0,
      area: null,
      pricePerMeter: null,
    });
    expect(result.financeCheckReasons).toEqual(["priced_without_area"]);
    expect(result.includeTotalInSum).toBe(true);
  });

  it("accepts plausible Green Avenue style door fees", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 600_000,
      doorFees: 30_000,
      aluminumFees: 25_000,
      area: 120,
      pricePerMeter: 5_000,
    });
    expect(result.showInFinanceDataCheck).toBe(false);
    expect(result.includeTotalInSum).toBe(true);
    expect(result.includeDoorInSum).toBe(true);
    expect(MAX_PLAUSIBLE_DOOR_FEES_EGP).toBe(100_000);
  });
});
