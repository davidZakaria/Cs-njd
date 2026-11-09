/** Fused Arabic violation wording (عدم+عمل without boundary) from bad draft saves or bad joins. */
export const FUSED_ADM_AMAL_PATTERN = /عدمعمل/u;

export const SPACED_ADM_AMAL_PATTERN = /عدم\s+عمل/u;

export function handoverTextHasFusedAdmAmal(text: string): boolean {
  return FUSED_ADM_AMAL_PATTERN.test(text);
}

export function assertNoFusedAdmAmalInHandoverText(text: string, context: string): void {
  if (handoverTextHasFusedAdmAmal(text)) {
    throw new Error(`${context}: fused "عدمعمل" found — expected spaced "عدم عمل"`);
  }
}

/** Source/draft text should include properly spaced violations and never fuse words. */
export function assertHandoverViolationWordBoundaries(text: string, context: string): void {
  assertNoFusedAdmAmalInHandoverText(text, context);
  if (!SPACED_ADM_AMAL_PATTERN.test(text)) {
    throw new Error(`${context}: missing spaced "عدم عمل" in handover violations text`);
  }
}

/** PDF page slices from pdftotext may split phrases across pages — forbid fusion only. */
export function assertHandoverPdfSliceNoFusion(text: string, context: string): void {
  assertNoFusedAdmAmalInHandoverText(text, context);
}
