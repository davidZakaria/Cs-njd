import { prisma as appPrisma } from "@/lib/prisma";

import { isGapTaskOverdue } from "@/lib/archive-check/gap-tasks";
import type { EscalationJobRunOptions } from "@/lib/cron/escalation-job-options";
import { notifyRolesInboxTab } from "@/lib/notifications/inbox-delivery";
import { resolveActiveUserIdsForRoles } from "@/lib/notifications/inbox-recipients";
import { recordRequestAuditEvent } from "@/lib/requests/audit";

export type ArchiveGapEscalationDb = typeof appPrisma;

export type ArchiveGapEscalationPreview = {
  wouldEscalateGaps: Array<{
    gapTaskId: string;
    requestId: string;
    unitCode: string;
    itemKey: string;
    recipientUserIds: string[];
  }>;
  skippedCooldownGapTaskIds: string[];
};

export type ArchiveGapEscalationJobResult = {
  scanned: number;
  notified: number;
  preview?: ArchiveGapEscalationPreview;
};

export async function runArchiveCheckGapEscalationJob(
  prisma: ArchiveGapEscalationDb,
  options?: EscalationJobRunOptions
): Promise<ArchiveGapEscalationJobResult> {
  const dryRun = options?.dryRun === true;
  const ESCALATION_COOLDOWN_MS = 20 * 60 * 60 * 1000;
  const now = new Date();
  const preview: ArchiveGapEscalationPreview = {
    wouldEscalateGaps: [],
    skippedCooldownGapTaskIds: [],
  };

  const openTasks = await prisma.archiveCheckGapTask.findMany({
    where: { status: "OPEN", deadlineAt: { lt: now } },
    take: 500,
    include: {
      unitRequest: {
        include: {
          unit: {
            select: {
              id: true,
              unitCode: true,
              project: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { deadlineAt: "asc" },
  });

  let notified = 0;

  for (const task of openTasks) {
    if (
      !isGapTaskOverdue({
        status: task.status,
        deadlineAt: task.deadlineAt,
        now,
      })
    ) {
      continue;
    }

    if (
      task.lastEscalatedAt &&
      now.getTime() - task.lastEscalatedAt.getTime() < ESCALATION_COOLDOWN_MS
    ) {
      if (dryRun) {
        preview.skippedCooldownGapTaskIds.push(task.id);
      }
      continue;
    }

    const unit = task.unitRequest.unit;
    if (!unit) {
      continue;
    }

    if (dryRun) {
      preview.wouldEscalateGaps.push({
        gapTaskId: task.id,
        requestId: task.unitRequestId,
        unitCode: unit.unitCode,
        itemKey: task.itemKey,
        recipientUserIds: await resolveActiveUserIdsForRoles(prisma, [
          "MANAGEMENT",
          "SUPER_ADMIN",
        ]),
      });
    } else {
      await notifyRolesInboxTab({
        roles: ["MANAGEMENT", "SUPER_ADMIN"],
        inboxTab: "REQUESTS_AND_FILES",
        titleEn: "Overdue contract papers check gap",
        titleAr: "فجوة متأخرة في مراجعة أوراق العقد",
        messageEn: `${unit.project.name} · ${unit.unitCode} · ${task.itemKey}`,
        messageAr: `${unit.project.name} · ${unit.unitCode} · ${task.itemKey}`,
        link: `/requests/${task.unitRequestId}`,
      });

      await prisma.archiveCheckGapTask.update({
        where: { id: task.id },
        data: {
          escalatedToManagement: true,
          lastEscalatedAt: now,
          ownerRole: "MANAGEMENT",
          ownerUserId: task.ownerUserId,
        },
      });

      await prisma.unitRequest.update({
        where: { id: task.unitRequestId },
        data: { escalatedToManagement: true, lastEscalatedAt: now },
      });

      await recordRequestAuditEvent({
        requestId: task.unitRequestId,
        action: "archive_gap_escalated",
        details: { itemKey: task.itemKey, gapTaskId: task.id },
      });

      notified += 1;
    }
  }

  return {
    notified: dryRun ? 0 : notified,
    scanned: openTasks.length,
    ...(dryRun ? { preview } : {}),
  };
}

export function getArchiveGapEscalationCronSchedule(): string {
  return (
    process.env.ARCHIVE_GAP_ESCALATION_CRON ??
    process.env.REQUEST_ESCALATION_CRON ??
    "0 8 * * *"
  );
}
