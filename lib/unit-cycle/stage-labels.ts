import type { UnitCycleStageKey } from "@prisma/client";

const STAGE_LABELS: Record<
  UnitCycleStageKey,
  { en: string; ar: string }
> = {
  CONTRACT: { en: "Contract", ar: "العقد" },
  FINANCE: { en: "Finance", ar: "المالية" },
  ENGINEERING: { en: "Engineering", ar: "الهندسة" },
  LEGAL_HANDOVER: { en: "Legal & handover", ar: "القانونية والتسليم" },
};

export function unitCycleStageLabel(
  stageKey: UnitCycleStageKey,
  locale: "en" | "ar"
): string {
  return STAGE_LABELS[stageKey][locale];
}

export function unitCycleStageLabelEnAr(stageKey: UnitCycleStageKey): {
  en: string;
  ar: string;
} {
  return STAGE_LABELS[stageKey];
}
