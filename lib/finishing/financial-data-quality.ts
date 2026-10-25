/**
 * Read-only rules for executive finishing revenue totals.
 * Typical door fees in portfolio data: ~25k–30k EGP; concatenation bugs can produce billions.
 */

/** EGP — door fees above this are treated as bad data (see audit: 3,000,037,032 concatenation). */
export const MAX_PLAUSIBLE_DOOR_FEES_EGP = 100_000;

/** EGP — aluminum line items above this are treated as implausible for executive totals. */
export const MAX_PLAUSIBLE_ALUMINUM_FEES_EGP = 500_000;

/** EGP — finishing contract totals below this are too low for a full finishing package. */
export const MIN_PLAUSIBLE_TOTAL_FINISHING_EGP = 300_000;

/** EGP/m² — when unit area is known, finishing total per m² must fall in this band. */
export const MIN_FINISHING_PRICE_PER_SQM_EGP = 1_000;
export const MAX_FINISHING_PRICE_PER_SQM_EGP = 50_000;

export type FinishingFinancialInput = {
  totalFinishingPrice: number | null | undefined;
  doorFees: number | null | undefined;
  aluminumFees: number | null | undefined;
  area: number | null | undefined;
};

export type FinishingDataQualityReason =
  | "doorFees_implausible"
  | "aluminumFees_implausible"
  | "total_zero_or_negative"
  | "total_below_minimum"
  | "total_fee_only"
  | "total_per_sqm_high"
  | "total_per_sqm_low"
  | "priced_without_area";

export type FinishingDataQualityResult = {
  reasons: FinishingDataQualityReason[];
  flagged: boolean;
  excludeFromTotals: boolean;
};

function num(value: number | null | undefined): number {
  return value ?? 0;
}

/** Flagged rows appear in Finance data check; excluded rows do not affect summed totals. */
export function shouldExcludeFromFinancialTotals(
  reasons: FinishingDataQualityReason[]
): boolean {
  if (reasons.length === 0) return false;
  return reasons.some((reason) => reason !== "priced_without_area");
}

export function assessFinishingFinancialData(
  input: FinishingFinancialInput
): FinishingDataQualityResult {
  const reasons: FinishingDataQualityReason[] = [];
  const total = num(input.totalFinishingPrice);
  const door = num(input.doorFees);
  const aluminum = num(input.aluminumFees);
  const area = input.area;

  if (door > MAX_PLAUSIBLE_DOOR_FEES_EGP) {
    reasons.push("doorFees_implausible");
  }
  if (aluminum > MAX_PLAUSIBLE_ALUMINUM_FEES_EGP) {
    reasons.push("aluminumFees_implausible");
  }

  if (total <= 0) {
    reasons.push("total_zero_or_negative");
  } else {
    if (total < MIN_PLAUSIBLE_TOTAL_FINISHING_EGP) {
      reasons.push("total_below_minimum");
    }
    if (door + aluminum > 0 && total === door + aluminum) {
      reasons.push("total_fee_only");
    }
    if (area != null && area > 0) {
      const perSqm = total / area;
      if (perSqm > MAX_FINISHING_PRICE_PER_SQM_EGP) {
        reasons.push("total_per_sqm_high");
      }
      if (perSqm < MIN_FINISHING_PRICE_PER_SQM_EGP) {
        reasons.push("total_per_sqm_low");
      }
    } else {
      reasons.push("priced_without_area");
    }
  }

  const flagged = reasons.length > 0;
  const excludeFromTotals = shouldExcludeFromFinancialTotals(reasons);

  return { reasons, flagged, excludeFromTotals };
}
