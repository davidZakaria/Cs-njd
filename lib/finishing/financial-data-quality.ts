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

/** Relative tolerance between pricePerMeter × area and totalFinishingPrice. */
export const TOTAL_MISMATCH_PRICE_PER_SQM_TOLERANCE = 0.2;

export type FinishingFinancialInput = {
  totalFinishingPrice: number | null | undefined;
  doorFees: number | null | undefined;
  aluminumFees: number | null | undefined;
  area: number | null | undefined;
  pricePerMeter?: number | null | undefined;
};

export type FinishingDataQualityReason =
  | "doorFees_implausible"
  | "aluminumFees_implausible"
  | "total_zero_or_negative"
  | "total_below_minimum"
  | "total_fee_only"
  | "total_per_sqm_high"
  | "total_per_sqm_low"
  | "total_mismatch_price_per_sqm"
  | "priced_without_area";

export type FinishingFinancialAssessment = {
  /** No total and no fee lines — not a data error (e.g. empty Jamila imports). */
  isEmpty: boolean;
  financeCheckReasons: FinishingDataQualityReason[];
  showInFinanceDataCheck: boolean;
  includeTotalInSum: boolean;
  includeDoorInSum: boolean;
  includeAluminumInSum: boolean;
};

function num(value: number | null | undefined): number {
  return value ?? 0;
}

export function isEmptyFinishingFinancialRow(
  input: FinishingFinancialInput
): boolean {
  const total = num(input.totalFinishingPrice);
  const door = num(input.doorFees);
  const aluminum = num(input.aluminumFees);
  return total <= 0 && door <= 0 && aluminum <= 0;
}

function assessTotalFinishingReasons(
  input: FinishingFinancialInput
): FinishingDataQualityReason[] {
  const reasons: FinishingDataQualityReason[] = [];
  const total = num(input.totalFinishingPrice);
  const door = num(input.doorFees);
  const aluminum = num(input.aluminumFees);
  const area = input.area;
  const pricePerMeter = num(input.pricePerMeter);

  if (total <= 0) {
    reasons.push("total_zero_or_negative");
    return reasons;
  }

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
    if (pricePerMeter > 0) {
      const implied = pricePerMeter * area;
      if (Math.abs(implied - total) / total > TOTAL_MISMATCH_PRICE_PER_SQM_TOLERANCE) {
        reasons.push("total_mismatch_price_per_sqm");
      }
    }
  } else {
    reasons.push("priced_without_area");
  }

  return reasons;
}

function excludesTotalFromSum(reasons: FinishingDataQualityReason[]): boolean {
  return reasons.some((reason) => reason !== "priced_without_area");
}

export function assessFinishingFinancialData(
  input: FinishingFinancialInput
): FinishingFinancialAssessment {
  if (isEmptyFinishingFinancialRow(input)) {
    return {
      isEmpty: true,
      financeCheckReasons: [],
      showInFinanceDataCheck: false,
      includeTotalInSum: false,
      includeDoorInSum: false,
      includeAluminumInSum: false,
    };
  }

  const total = num(input.totalFinishingPrice);
  const door = num(input.doorFees);
  const aluminum = num(input.aluminumFees);

  const financeCheckReasons: FinishingDataQualityReason[] = [];
  const doorPlausible = door <= MAX_PLAUSIBLE_DOOR_FEES_EGP;
  const aluminumPlausible = aluminum <= MAX_PLAUSIBLE_ALUMINUM_FEES_EGP;

  if (door > 0 && !doorPlausible) {
    financeCheckReasons.push("doorFees_implausible");
  }
  if (aluminum > 0 && !aluminumPlausible) {
    financeCheckReasons.push("aluminumFees_implausible");
  }

  const totalReasons = assessTotalFinishingReasons(input);
  for (const reason of totalReasons) {
    if (!financeCheckReasons.includes(reason)) {
      financeCheckReasons.push(reason);
    }
  }

  const includeTotalInSum = total > 0 && !excludesTotalFromSum(totalReasons);
  const includeDoorInSum = door > 0 && doorPlausible;
  const includeAluminumInSum = aluminum > 0 && aluminumPlausible;

  return {
    isEmpty: false,
    financeCheckReasons,
    showInFinanceDataCheck: financeCheckReasons.length > 0,
    includeTotalInSum,
    includeDoorInSum,
    includeAluminumInSum,
  };
}

/** @deprecated Use per-field flags on FinishingFinancialAssessment */
export function shouldExcludeFromFinancialTotals(
  reasons: FinishingDataQualityReason[]
): boolean {
  return excludesTotalFromSum(reasons);
}
