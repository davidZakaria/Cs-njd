import type { UnitRequestStatus, UnitRequestType } from "@prisma/client";

import { isBulkArchiveCheckParent } from "@/lib/archive-check/permissions";

export const OPEN_ARCHIVE_CHECK_STATUSES: UnitRequestStatus[] = ["DRAFT", "PENDING"];

export function isOpenArchiveCheckStatus(status: UnitRequestStatus): boolean {
  return OPEN_ARCHIVE_CHECK_STATUSES.includes(status);
}

export function requestCountsAsOpenArchiveCheckOnUnit(input: {
  type: UnitRequestType;
  status: UnitRequestStatus;
  unitId: string | null;
  bulkProjectId: string | null;
  parentRequestId: string | null;
}): boolean {
  if (input.type !== "ARCHIVE_CHECK") return false;
  if (!isOpenArchiveCheckStatus(input.status)) return false;
  if (!input.unitId) return false;
  if (
    isBulkArchiveCheckParent({
      type: input.type,
      bulkProjectId: input.bulkProjectId,
      parentRequestId: input.parentRequestId,
    })
  ) {
    return false;
  }
  return true;
}

export function unitIdsWithOpenArchiveChecks(
  rows: Array<{ unitId: string | null }>
): Set<string> {
  return new Set(
    rows.map((row) => row.unitId).filter((id): id is string => id != null)
  );
}
