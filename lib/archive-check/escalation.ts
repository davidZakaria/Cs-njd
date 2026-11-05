import { prisma as appPrisma } from "@/lib/prisma";

import { isGapTaskOverdue } from "@/lib/archive-check/gap-tasks";
import { recordRequestAuditEvent } from "@/lib/requests/audit";

export type ArchiveGapEscalationDb = typeof appPrisma;

export async function runArchiveCheckGapEscalationJob(
  prisma: ArchiveGapEscalationDb
): Promise<{ notified: number; scanned: number }> {
  const ESCALATION_COOLDOWN_MS = 20 * 60 * 60 * 1000;
  const now = new Date();

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
  const { notifyRolesInboxTab } = await import("@/lib/notifications/inbox.server");

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
      continue;
    }

    const unit = task.unitRequest.unit;
    if (!unit) {
      continue;
    }
    await notifyRolesInboxTab({
      roles: ["MANAGEMENT", "SUPER_ADMIN"],
      inboxTab: "REQUESTS_AND_FILES",
      titleEn: "Overdue archive check gap",
      titleAr: "فجوة فحص أرشيف متأخرة",
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

  return { notified, scanned: openTasks.length };
}

export function getArchiveGapEscalationCronSchedule(): string {
  return (
    process.env.ARCHIVE_GAP_ESCALATION_CRON ??
    process.env.REQUEST_ESCALATION_CRON ??
    "0 8 * * *"
  );
}
