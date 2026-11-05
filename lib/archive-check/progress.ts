import type { ArchiveCheckGapTaskStatus, ArchiveCheckItemStatus } from "@prisma/client";

import type { ArchiveCheckItemKey } from "@/lib/archive-check/items";
import { resolveGapOwnerRoleForItem } from "@/lib/archive-check/routing";
import type { OrgStaffAvailability } from "@/lib/requests/approver-roles";

export type ArchiveCheckProgressItem = {
  itemKey: ArchiveCheckItemKey;
  displayStatus: "done" | "missing" | "being_fixed";
  fixingDepartment: "LEGAL" | "FINANCE" | "MANAGEMENT" | null;
  archiveStatus: ArchiveCheckItemStatus;
  gapTaskStatus: ArchiveCheckGapTaskStatus | null;
};

export function buildArchiveCheckProgressItems(input: {
  items: Array<{ itemKey: string; status: ArchiveCheckItemStatus }>;
  gapTasks: Array<{ itemKey: string; status: ArchiveCheckGapTaskStatus }>;
  staff?: OrgStaffAvailability;
}): ArchiveCheckProgressItem[] {
  const staff = input.staff;
  const gapByKey = new Map(input.gapTasks.map((task) => [task.itemKey, task.status]));

  return input.items.map((item) => {
    const itemKey = item.itemKey as ArchiveCheckItemKey;
    const gapStatus = gapByKey.get(item.itemKey) ?? null;

    if (item.status === "FOUND") {
      return {
        itemKey,
        displayStatus: "done" as const,
        fixingDepartment: null,
        archiveStatus: item.status,
        gapTaskStatus: gapStatus,
      };
    }

    if (gapStatus === "OPEN") {
      const dept = staff
        ? resolveGapOwnerRoleForItem(itemKey, staff)
        : ("MANAGEMENT" as const);
      return {
        itemKey,
        displayStatus: "being_fixed" as const,
        fixingDepartment: dept,
        archiveStatus: item.status,
        gapTaskStatus: gapStatus,
      };
    }

    if (item.status === "MISSING" || item.status === "UNSIGNED") {
      return {
        itemKey,
        displayStatus: "missing" as const,
        fixingDepartment: null,
        archiveStatus: item.status,
        gapTaskStatus: gapStatus,
      };
    }

    return {
      itemKey,
      displayStatus: "missing" as const,
      fixingDepartment: null,
      archiveStatus: item.status,
      gapTaskStatus: gapStatus,
    };
  });
}

export function summarizeArchiveCheckProgress(items: ArchiveCheckProgressItem[]): {
  doneCount: number;
  totalCount: number;
} {
  const totalCount = items.length;
  const doneCount = items.filter((item) => item.displayStatus === "done").length;
  return { doneCount, totalCount };
}
