import { describe, expect, it } from "vitest";

import {
  assessFinishingFinancialData,
  MAX_PLAUSIBLE_DOOR_FEES_EGP,
  shouldExcludeFromFinancialTotals,
} from "@/lib/finishing/financial-data-quality";

describe("financial-data-quality", () => {
  it("flags concatenated door fees and excludes from totals", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 3_000_037_032,
      doorFees: 3_000_037_032,
      aluminumFees: 0,
      area: 120,
    });
    expect(result.reasons).toContain("doorFees_implausible");
    expect(result.excludeFromTotals).toBe(true);
  });

  it("flags sale-price-like totals via per-m² when area is known", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 16_650_000,
      doorFees: 0,
      aluminumFees: 0,
      area: 110,
    });
    expect(result.reasons).toContain("total_per_sqm_high");
    expect(result.excludeFromTotals).toBe(true);
  });

  it("flags fee-only rows where total equals door plus aluminum", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 55_000,
      doorFees: 30_000,
      aluminumFees: 25_000,
      area: 100,
    });
    expect(result.reasons).toContain("total_fee_only");
    expect(result.excludeFromTotals).toBe(true);
  });

  it("flags priced without area but still includes in totals", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 800_000,
      doorFees: 0,
      aluminumFees: 0,
      area: null,
    });
    expect(result.reasons).toEqual(["priced_without_area"]);
    expect(result.excludeFromTotals).toBe(false);
    expect(shouldExcludeFromFinancialTotals(result.reasons)).toBe(false);
  });

  it("flags zero totals", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 0,
      doorFees: 0,
      aluminumFees: 0,
      area: 90,
    });
    expect(result.reasons).toContain("total_zero_or_negative");
    expect(result.excludeFromTotals).toBe(true);
  });

  it("accepts plausible Green Avenue style door fees", () => {
    const result = assessFinishingFinancialData({
      totalFinishingPrice: 600_000,
      doorFees: 30_000,
      aluminumFees: 25_000,
      area: 120,
    });
    expect(result.flagged).toBe(false);
    expect(MAX_PLAUSIBLE_DOOR_FEES_EGP).toBe(100_000);
  });
});
