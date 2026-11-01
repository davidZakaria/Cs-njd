import type { UnitCycleStageKey, UnitRequestStatus, UnitRequestType } from "@prisma/client";

import { unitCycleStageForRequestType } from "@/lib/requests/stage-mapping";

export const OPEN_UNIT_REQUEST_STATUSES: UnitRequestStatus[] = [
  "DRAFT",
  "PENDING",
];

export type UnitRequestStageBlocker = {
  id: string;
  type: UnitRequestType;
  status: UnitRequestStatus;
  unitCycleStageKey: UnitCycleStageKey | null;
};

export function isOpenUnitRequestStatus(status: UnitRequestStatus): boolean {
  return OPEN_UNIT_REQUEST_STATUSES.includes(status);
}

export function requestBlocksUnitCycleStage(input: {
  unitCycleEnabled: boolean;
  stageKey: UnitCycleStageKey;
  request: Pick<
    UnitRequestStageBlocker,
    "status" | "type" | "unitCycleStageKey"
  >;
}): boolean {
  if (!input.unitCycleEnabled) return false;
  if (!isOpenUnitRequestStatus(input.request.status)) return false;

  const mappedStage =
    input.request.unitCycleStageKey ??
    unitCycleStageForRequestType(input.request.type);
  if (mappedStage == null) return false;

  return mappedStage === input.stageKey;
}

export function blockingRequestsForStage(
  stageKey: UnitCycleStageKey,
  requests: UnitRequestStageBlocker[],
  unitCycleEnabled: boolean
): UnitRequestStageBlocker[] {
  return requests.filter((request) =>
    requestBlocksUnitCycleStage({
      unitCycleEnabled,
      stageKey,
      request,
    })
  );
}

export function stageIsBlockedByOpenRequests(input: {
  unitCycleEnabled: boolean;
  stageKey: UnitCycleStageKey;
  openRequests: UnitRequestStageBlocker[];
}): boolean {
  return blockingRequestsForStage(
    input.stageKey,
    input.openRequests,
    input.unitCycleEnabled
  ).length > 0;
}
