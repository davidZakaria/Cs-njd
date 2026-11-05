import type {
  ArchiveCheckGapTaskStatus,
  ArchiveCheckItemStatus,
  Role,
} from "@prisma/client";

import { prisma as appPrisma } from "@/lib/prisma";
import type { ArchiveCheckItemKey } from "@/lib/archive-check/items";
import {
  resolveGapOwnerRoleForItem,
  unitCycleStageForGapItem,
} from "@/lib/archive-check/routing";
import { computeDefaultDueDate } from "@/lib/requests/workflow-helpers";
import type { OrgStaffAvailability } from "@/lib/requests/approver-roles";

export type ArchiveCheckGapTaskDb = typeof appPrisma;

export async function pickActiveOwnerUserId(
  prisma: ArchiveCheckGapTaskDb,
  role: Role
): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { role, isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function createGapTasksForArchiveCheck(input: {
  prisma: ArchiveCheckGapTaskDb;
  unitRequestId: string;
  staff: OrgStaffAvailability;
  now?: Date;
}): Promise<number> {
  const now = input.now ?? new Date();
  const deadlineAt = computeDefaultDueDate(now);

  const gapItems = await input.prisma.archiveCheckItem.findMany({
    where: {
      unitRequestId: input.unitRequestId,
      status: { in: ["MISSING", "UNSIGNED"] },
    },
    select: { itemKey: true, status: true },
  });

  let created = 0;
  for (const row of gapItems) {
    const itemKey = row.itemKey as ArchiveCheckItemKey;
    const ownerRole = resolveGapOwnerRoleForItem(itemKey, input.staff);

    await input.prisma.archiveCheckGapTask.create({
      data: {
        unitRequestId: input.unitRequestId,
        itemKey: row.itemKey,
        ownerRole,
        ownerUserId: null,
        deadlineAt,
        unitCycleStageKey: unitCycleStageForGapItem(itemKey),
      },
    });
    created += 1;
  }

  return created;
}

export async function tryCompleteArchiveCheckRequest(input: {
  prisma: ArchiveCheckGapTaskDb;
  unitRequestId: string;
  resolvedById: string;
  now?: Date;
}): Promise<boolean> {
  const openCount = await input.prisma.archiveCheckGapTask.count({
    where: { unitRequestId: input.unitRequestId, status: "OPEN" },
  });
  if (openCount > 0) return false;

  const now = input.now ?? new Date();
  await input.prisma.unitRequest.update({
    where: { id: input.unitRequestId },
    data: {
      status: "APPROVED",
      resolvedAt: now,
      resolvedById: input.resolvedById,
      currentApproverKind: null,
    },
  });
  return true;
}

export function isGapTaskOverdue(input: {
  status: ArchiveCheckGapTaskStatus;
  deadlineAt: Date;
  now?: Date;
}): boolean {
  if (input.status !== "OPEN") return false;
  const now = input.now ?? new Date();
  return input.deadlineAt.getTime() < now.getTime();
}

export function archiveItemRequiresGapTask(
  status: ArchiveCheckItemStatus
): boolean {
  return status === "MISSING" || status === "UNSIGNED";
}
