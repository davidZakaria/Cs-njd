import type { UnitCycleStageKey, UnitCycleStageStatus } from "@prisma/client";

import {
  isStageChecklistComplete,
  resolveActiveStageKey,
  UNIT_CYCLE_STAGE_ORDER,
  type UnitOperationsSnapshot,
} from "@/lib/operations/operations-progress";
import type { UnitRequestStageBlocker } from "@/lib/unit-cycle/stage-request-blocking";
import {
  stageIsBlockedByOpenRequests,
} from "@/lib/unit-cycle/stage-request-blocking";
import {
  stageIsBlockedByArchiveGaps,
  type ArchiveGapStageBlocker,
} from "@/lib/archive-check/stage-blocking";

export function canCompleteStage(
  stageKey: UnitCycleStageKey,
  status: UnitCycleStageStatus,
  snapshot: UnitOperationsSnapshot,
  options?: {
    unitCycleEnabled?: boolean;
    openRequests?: UnitRequestStageBlocker[];
    openGapTasks?: ArchiveGapStageBlocker[];
  }
): boolean {
  if (status === "DONE" || status === "NOT_STARTED") {
    return false;
  }
  if (!isStageChecklistComplete(stageKey, snapshot)) {
    return false;
  }
  if (options?.unitCycleEnabled && options.openRequests) {
    if (
      stageIsBlockedByOpenRequests({
        unitCycleEnabled: true,
        stageKey,
        openRequests: options.openRequests,
      })
    ) {
      return false;
    }
  }
  if (options?.unitCycleEnabled && options.openGapTasks) {
    if (
      stageIsBlockedByArchiveGaps({
        unitCycleEnabled: true,
        stageKey,
        openGapTasks: options.openGapTasks,
      })
    ) {
      return false;
    }
  }
  return true;
}

export function nextStageKey(
  stageKey: UnitCycleStageKey
): UnitCycleStageKey | null {
  const index = UNIT_CYCLE_STAGE_ORDER.indexOf(stageKey);
  if (index < 0 || index >= UNIT_CYCLE_STAGE_ORDER.length - 1) {
    return null;
  }
  return UNIT_CYCLE_STAGE_ORDER[index + 1] ?? null;
}

export function isStageOverdue(input: {
  status: UnitCycleStageStatus;
  deadlineAt: Date | null;
  now?: Date;
}): boolean {
  if (input.status === "DONE" || input.status === "NOT_STARTED") {
    return false;
  }
  if (!input.deadlineAt) return false;
  const now = input.now ?? new Date();
  return input.deadlineAt.getTime() < now.getTime();
}

export function assertActiveStage(
  stages: { stageKey: UnitCycleStageKey; status: UnitCycleStageStatus }[],
  target: UnitCycleStageKey
): boolean {
  return resolveActiveStageKey(stages) === target;
}
