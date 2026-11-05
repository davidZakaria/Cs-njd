import type { UnitCycleStageKey } from "@prisma/client";

import type { UnitRequestStageBlocker } from "@/lib/unit-cycle/stage-request-blocking";
import {
  blockingRequestsForStage,
  requestBlocksUnitCycleStage,
} from "@/lib/unit-cycle/stage-request-blocking";

export type ArchiveGapStageBlocker = {
  id: string;
  unitRequestId: string;
  itemKey: string;
  unitCycleStageKey: UnitCycleStageKey | null;
};

export function gapTaskBlocksUnitCycleStage(input: {
  unitCycleEnabled: boolean;
  stageKey: UnitCycleStageKey;
  task: Pick<ArchiveGapStageBlocker, "unitCycleStageKey">;
}): boolean {
  if (!input.unitCycleEnabled) return false;
  if (!input.task.unitCycleStageKey) return false;
  return input.task.unitCycleStageKey === input.stageKey;
}

export function blockingGapTasksForStage(
  stageKey: UnitCycleStageKey,
  tasks: ArchiveGapStageBlocker[],
  unitCycleEnabled: boolean
): ArchiveGapStageBlocker[] {
  return tasks.filter((task) =>
    gapTaskBlocksUnitCycleStage({
      unitCycleEnabled,
      stageKey,
      task,
    })
  );
}

export function mergeStageBlockers(input: {
  unitCycleEnabled: boolean;
  stageKey: UnitCycleStageKey;
  openRequests: UnitRequestStageBlocker[];
  openGapTasks: ArchiveGapStageBlocker[];
}): {
  requests: UnitRequestStageBlocker[];
  gapTasks: ArchiveGapStageBlocker[];
} {
  return {
    requests: blockingRequestsForStage(
      input.stageKey,
      input.openRequests,
      input.unitCycleEnabled
    ),
    gapTasks: blockingGapTasksForStage(
      input.stageKey,
      input.openGapTasks,
      input.unitCycleEnabled
    ),
  };
}

export function stageIsBlockedByArchiveGaps(input: {
  unitCycleEnabled: boolean;
  stageKey: UnitCycleStageKey;
  openGapTasks: ArchiveGapStageBlocker[];
}): boolean {
  return (
    blockingGapTasksForStage(
      input.stageKey,
      input.openGapTasks,
      input.unitCycleEnabled
    ).length > 0
  );
}

export function requestOrGapBlocksStage(input: {
  unitCycleEnabled: boolean;
  stageKey: UnitCycleStageKey;
  request: Parameters<typeof requestBlocksUnitCycleStage>[0]["request"];
  openGapTasks: ArchiveGapStageBlocker[];
}): boolean {
  if (
    requestBlocksUnitCycleStage({
      unitCycleEnabled: input.unitCycleEnabled,
      stageKey: input.stageKey,
      request: input.request,
    })
  ) {
    return true;
  }
  return stageIsBlockedByArchiveGaps({
    unitCycleEnabled: input.unitCycleEnabled,
    stageKey: input.stageKey,
    openGapTasks: input.openGapTasks,
  });
}
