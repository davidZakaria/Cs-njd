import type { FinishingPhase } from "@prisma/client";
import { FINISHING_PHASE_OPTIONS } from "@/lib/validations/finishing";

export const FINISHING_PHASE_ORDER = FINISHING_PHASE_OPTIONS;

export function sortPhases(phases: FinishingPhase[]): FinishingPhase[] {
  const set = new Set(phases);
  return FINISHING_PHASE_ORDER.filter((phase) => set.has(phase));
}

export function normalizeFinishingPhases(
  phases: FinishingPhase[] | null | undefined
): FinishingPhase[] {
  if (!phases?.length) return ["NOT_STARTED"];
  const unique = [...new Set(phases)];
  if (unique.includes("FINISHED") && unique.length > 1) {
    return ["FINISHED"];
  }
  if (unique.includes("NOT_STARTED") && unique.length > 1) {
    return sortPhases(unique.filter((phase) => phase !== "NOT_STARTED"));
  }
  return sortPhases(unique);
}

export function toggleFinishingPhase(
  current: FinishingPhase[],
  phase: FinishingPhase
): FinishingPhase[] {
  if (phase === "NOT_STARTED") {
    return ["NOT_STARTED"];
  }

  if (phase === "FINISHED") {
    const active = current.filter((item) => item !== "NOT_STARTED");
    if (active.includes("FINISHED")) {
      return ["NOT_STARTED"];
    }
    return ["FINISHED"];
  }

  const withoutExclusive = current.filter(
    (item) => item !== "NOT_STARTED" && item !== "FINISHED"
  );
  const next = withoutExclusive.includes(phase)
    ? withoutExclusive.filter((item) => item !== phase)
    : [...withoutExclusive, phase];

  return next.length ? sortPhases(next) : ["NOT_STARTED"];
}

export function isFinishingWorkComplete(
  phases: FinishingPhase[] | null | undefined
): boolean {
  const normalized = normalizeFinishingPhases(phases);
  return normalized.includes("FINISHED");
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
