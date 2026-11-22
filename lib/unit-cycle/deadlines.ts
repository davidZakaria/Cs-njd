import type { Project, UnitCycleStageKey, UnitCycleStageStatus } from "@prisma/client";

import type { UnitOperationsSnapshot } from "@/lib/operations/operations-progress";

export const MS_PER_DAY = 86_400_000;

export function deadlineDaysForStage(
  project: Pick<
    Project,
    | "unitCycleContractDeadlineDays"
    | "unitCycleFinanceDeadlineDays"
    | "unitCycleEngineeringDeadlineDays"
    | "unitCycleLegalHandoverDeadlineDays"
  >,
  stageKey: UnitCycleStageKey
): number {
  switch (stageKey) {
    case "CONTRACT":
      return project.unitCycleContractDeadlineDays;
    case "FINANCE":
      return project.unitCycleFinanceDeadlineDays;
    case "ENGINEERING":
      return project.unitCycleEngineeringDeadlineDays;
    case "LEGAL_HANDOVER":
      return project.unitCycleLegalHandoverDeadlineDays;
    default:
      return 7;
  }
}

export function computeStageDeadline(
  startedAt: Date,
  days: number
): Date {
  const deadline = new Date(startedAt);
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}

/** Never schedule a deadline in the past relative to activation time. */
export function computeForwardStageDeadline(
  startedAt: Date,
  days: number,
  now: Date = new Date()
): Date {
  const fromStart = computeStageDeadline(startedAt, days);
  if (fromStart.getTime() > now.getTime()) {
    return fromStart;
  }
  return computeStageDeadline(now, days);
}

/** Historical anchor for display/audit; does not extend the legal deadline window by itself. */
export function resolveLegacyStageAnchor(
  stageKey: UnitCycleStageKey,
  snapshot: UnitOperationsSnapshot
): Date | null {
  if (stageKey !== "CONTRACT") return null;
  return snapshot.contractWorkflow?.contractDate ?? null;
}

export function resolveStageActivationStartedAt(input: {
  stageKey: UnitCycleStageKey;
  snapshot: UnitOperationsSnapshot;
  now: Date;
}): Date {
  const legacy = resolveLegacyStageAnchor(input.stageKey, input.snapshot);
  if (!legacy) return input.now;
  return legacy.getTime() <= input.now.getTime() ? legacy : input.now;
}

export type RetroactiveDeadlineReason =
  | "deadline_before_cycle_created"
  | "deadline_before_stage_start"
  | "active_deadline_in_past";

export function classifyRetroactiveUnitCycleDeadline(input: {
  status: UnitCycleStageStatus;
  startedAt: Date | null;
  deadlineAt: Date | null;
  unitCycleCreatedAt: Date;
  now?: Date;
}): RetroactiveDeadlineReason | null {
  const { status, startedAt, deadlineAt, unitCycleCreatedAt } = input;
  if (!deadlineAt) return null;
  const now = input.now ?? new Date();

  if (deadlineAt.getTime() < unitCycleCreatedAt.getTime()) {
    return "deadline_before_cycle_created";
  }
  if (startedAt && deadlineAt.getTime() < startedAt.getTime()) {
    return "deadline_before_stage_start";
  }
  if (
    (status === "IN_PROGRESS" || status === "BLOCKED") &&
    deadlineAt.getTime() < now.getTime()
  ) {
    return "active_deadline_in_past";
  }
  return null;
}
