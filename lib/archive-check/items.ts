import {
  buildOperationsProgressItems,
  isGracePeriodAnnexApplicable,
  isFinishingTrackApplicable,
  OPERATIONS_PROGRESS_ITEM,
  type OperationsProgressInput,
  type OperationsProgressItemKey,
} from "@/lib/operations/operations-progress";

/** Archive checklist keys (subset of operations tracker document items). */
export const ARCHIVE_CHECK_ITEM_KEYS = [
  OPERATIONS_PROGRESS_ITEM.primaryOwnerId,
  OPERATIONS_PROGRESS_ITEM.coOwnerIds,
  OPERATIONS_PROGRESS_ITEM.preliminaryContract,
  OPERATIONS_PROGRESS_ITEM.gracePeriodAnnex,
  OPERATIONS_PROGRESS_ITEM.handoverRecord,
  OPERATIONS_PROGRESS_ITEM.finalContract,
  OPERATIONS_PROGRESS_ITEM.finishingContract,
  OPERATIONS_PROGRESS_ITEM.finishingFinancials,
] as const satisfies readonly OperationsProgressItemKey[];

export type ArchiveCheckItemKey = (typeof ARCHIVE_CHECK_ITEM_KEYS)[number];

export function isArchiveCheckItemKey(value: string): value is ArchiveCheckItemKey {
  return (ARCHIVE_CHECK_ITEM_KEYS as readonly string[]).includes(value);
}

export function applicableArchiveCheckItemKeys(
  input: OperationsProgressInput
): ArchiveCheckItemKey[] {
  const progressItems = buildOperationsProgressItems(input);
  const byKey = new Map(progressItems.map((item) => [item.key, item.status]));

  return ARCHIVE_CHECK_ITEM_KEYS.filter((key) => {
    const status = byKey.get(key);
    if (status === "not_applicable") return false;
    if (key === OPERATIONS_PROGRESS_ITEM.gracePeriodAnnex) {
      return isGracePeriodAnnexApplicable(input);
    }
    if (
      key === OPERATIONS_PROGRESS_ITEM.finishingContract ||
      key === OPERATIONS_PROGRESS_ITEM.finishingFinancials
    ) {
      return isFinishingTrackApplicable(input);
    }
    return true;
  });
}
