import type { FinishingPackage, FinishingPhase } from "@prisma/client";

/** Strict 9-step engineering sequence (handwritten site order). */
export const ENGINEERING_FINISHING_PHASES = [
  "PLUMBING_FOUNDATION",
  "ELECTRICAL_FOUNDATION",
  "PLASTERING_FOUNDATION",
  "CERAMIC_WORKS",
  "PAINTING_FINISHES",
  "ELECTRICAL_FINISHES",
  "INTERNAL_DOORS",
  "SANITARY_MIXERS",
  "FINAL_PAINT",
] as const satisfies readonly FinishingPhase[];

export type EngineeringFinishingPhase = (typeof ENGINEERING_FINISHING_PHASES)[number];

export const FINISHING_PHASE_ORDER: FinishingPhase[] = [
  "NOT_STARTED",
  ...ENGINEERING_FINISHING_PHASES,
];

const FULLY_FINISHED_PACKAGES = new Set<FinishingPackage>([
  "COMPANY_PACKAGE",
  "PACKAGE_1",
  "PACKAGE_2",
  "PACKAGE_3",
  "PACKAGE_4",
  "FURNITURE",
  "FURNITURE_AND_AC",
  "COMPANY_FINISHING",
  "FINISHING",
  "THREE_QUARTERS",
  "CUSTOM",
]);

const CHECKLIST_DISABLED_PACKAGES = new Set<FinishingPackage>([
  "CORE_AND_SHELL",
  "LESS_THAN_COMPANY",
]);

export function isFinishingChecklistEnabled(
  packageType: FinishingPackage | null | undefined
): boolean {
  if (!packageType) return false;
  if (CHECKLIST_DISABLED_PACKAGES.has(packageType)) return false;
  return FULLY_FINISHED_PACKAGES.has(packageType);
}

export function sortPhases(phases: FinishingPhase[]): FinishingPhase[] {
  const set = new Set(phases);
  return FINISHING_PHASE_ORDER.filter((phase) => set.has(phase));
}

export function normalizeFinishingPhases(
  phases: FinishingPhase[] | null | undefined
): FinishingPhase[] {
  if (!phases?.length) return ["NOT_STARTED"];
  const unique = [...new Set(phases)];
  if (unique.includes("NOT_STARTED") && unique.length > 1) {
    return sortPhases(unique.filter((phase) => phase !== "NOT_STARTED"));
  }
  return sortPhases(unique);
}

export function selectAllEngineeringPhases(): FinishingPhase[] {
  return [...ENGINEERING_FINISHING_PHASES];
}

export function toggleFinishingPhase(
  current: FinishingPhase[],
  phase: FinishingPhase
): FinishingPhase[] {
  if (phase === "NOT_STARTED") {
    return ["NOT_STARTED"];
  }

  const withoutNotStarted = current.filter((item) => item !== "NOT_STARTED");
  const next = withoutNotStarted.includes(phase)
    ? withoutNotStarted.filter((item) => item !== phase)
    : [...withoutNotStarted, phase];

  return next.length ? sortPhases(next) : ["NOT_STARTED"];
}

export function isFinishingWorkComplete(
  phases: FinishingPhase[] | null | undefined
): boolean {
  const normalized = normalizeFinishingPhases(phases);
  return ENGINEERING_FINISHING_PHASES.every((phase) => normalized.includes(phase));
}

export function hasTrackedFinishingWork(
  phases: FinishingPhase[] | null | undefined
): boolean {
  const normalized = normalizeFinishingPhases(phases);
  return !(
    normalized.length === 0 ||
    (normalized.length === 1 && normalized[0] === "NOT_STARTED")
  );
}

export function isFullyFinishedPackage(
  packageType: FinishingPackage | null | undefined
): boolean {
  return isFinishingChecklistEnabled(packageType);
}
