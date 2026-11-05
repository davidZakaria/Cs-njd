import type { ArchiveCheckGapTaskStatus, ArchiveCheckItemStatus, Role } from "@prisma/client";

import type { ArchiveCheckItemKey } from "@/lib/archive-check/items";

export type ArchiveCheckProgressItem = {
  itemKey: ArchiveCheckItemKey;
  displayStatus: "done" | "missing" | "not_checked" | "being_fixed";
  fixingDepartment: "LEGAL" | "FINANCE" | "MANAGEMENT" | null;
  archiveStatus: ArchiveCheckItemStatus;
  gapTaskStatus: ArchiveCheckGapTaskStatus | null;
};

export type ArchiveCheckGapTaskProgress = {
  itemKey: string;
  status: ArchiveCheckGapTaskStatus;
  ownerRole: Role;
};

function gapFixingDepartment(
  gapTask: ArchiveCheckGapTaskProgress | undefined
): "LEGAL" | "FINANCE" | "MANAGEMENT" | null {
  if (!gapTask || gapTask.status !== "OPEN") return null;
  if (
    gapTask.ownerRole === "LEGAL" ||
    gapTask.ownerRole === "FINANCE" ||
    gapTask.ownerRole === "MANAGEMENT"
  ) {
    return gapTask.ownerRole;
  }
  return null;
}

export function buildArchiveCheckProgressItems(input: {
  items: Array<{ itemKey: string; status: ArchiveCheckItemStatus }>;
  gapTasks: ArchiveCheckGapTaskProgress[];
}): ArchiveCheckProgressItem[] {
  const gapByKey = new Map(input.gapTasks.map((task) => [task.itemKey, task]));

  return input.items.map((item) => {
    const itemKey = item.itemKey as ArchiveCheckItemKey;
    const gapTask = gapByKey.get(item.itemKey);
    const gapStatus = gapTask?.status ?? null;

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
      return {
        itemKey,
        displayStatus: "being_fixed" as const,
        fixingDepartment: gapFixingDepartment(gapTask),
        archiveStatus: item.status,
        gapTaskStatus: gapStatus,
      };
    }

    if (item.status === "PENDING") {
      return {
        itemKey,
        displayStatus: "not_checked" as const,
        fixingDepartment: null,
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
