import type { Role, UnitCycleStageKey } from "@prisma/client";

import {
  OPERATIONS_PROGRESS_ITEM,
  type OperationsProgressItemKey,
} from "@/lib/operations/operations-progress";
import type { OrgStaffAvailability } from "@/lib/requests/approver-roles";
import type { ArchiveCheckItemKey } from "@/lib/archive-check/items";

const LEGAL_ITEMS = new Set<OperationsProgressItemKey>([
  OPERATIONS_PROGRESS_ITEM.primaryOwnerId,
  OPERATIONS_PROGRESS_ITEM.coOwnerIds,
  OPERATIONS_PROGRESS_ITEM.preliminaryContract,
  OPERATIONS_PROGRESS_ITEM.gracePeriodAnnex,
  OPERATIONS_PROGRESS_ITEM.handoverRecord,
  OPERATIONS_PROGRESS_ITEM.finalContract,
]);

const FINANCE_ITEMS = new Set<OperationsProgressItemKey>([
  OPERATIONS_PROGRESS_ITEM.finishingContract,
  OPERATIONS_PROGRESS_ITEM.finishingFinancials,
]);

export type ArchiveGapOwnerRole = Extract<Role, "LEGAL" | "FINANCE" | "MANAGEMENT">;

export function resolveGapOwnerRoleForItem(
  itemKey: ArchiveCheckItemKey,
  staff: OrgStaffAvailability
): ArchiveGapOwnerRole {
  if (FINANCE_ITEMS.has(itemKey)) {
    return staff.hasFinanceStaff ? "FINANCE" : "MANAGEMENT";
  }
  if (LEGAL_ITEMS.has(itemKey)) {
    return staff.hasLegalStaff ? "LEGAL" : "MANAGEMENT";
  }
  return "MANAGEMENT";
}

export function unitCycleStageForGapItem(
  itemKey: ArchiveCheckItemKey
): UnitCycleStageKey {
  if (FINANCE_ITEMS.has(itemKey)) return "FINANCE";
  return "LEGAL_HANDOVER";
}
