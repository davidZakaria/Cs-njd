import type { UnitCycleStageKey } from "@prisma/client";

import { projectNameToSlug } from "@/lib/cases/cases-filter-url";
import { buildOverdueTasksPageUrl } from "@/lib/unit-cycle/overdue-filter-url";
import {
  groupOverdueStagesForDigest,
  groupOverdueStagesForOwnerDigest,
} from "@/lib/unit-cycle/overdue-digest";
import { recordUnitCycleAuditEvent } from "@/lib/unit-cycle/audit";
import {
  getOverdueStagesForManagement,
  type OverdueStageRow,
  type UnitCycleDb,
} from "@/lib/unit-cycle/queries";
import { unitCycleStageLabelEnAr } from "@/lib/unit-cycle/stage-labels";

function digestDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export { groupOverdueStagesForDigest, groupOverdueStagesForOwnerDigest } from "@/lib/unit-cycle/overdue-digest";

export async function runUnitCycleEscalationJob(
  prisma: UnitCycleDb
): Promise<{ notified: number; scanned: number }> {
  const overdue = await getOverdueStagesForManagement(prisma, 500);
  const now = new Date();
  const dayKey = digestDayKey(now);
  const groups = groupOverdueStagesForDigest(overdue);
  let notified = 0;
  const { notifyRolesInboxTab, notifyUserInboxTab } = await import(
    "@/lib/notifications/inbox.server"
  );

  for (const group of groups) {
    const stageLabels = unitCycleStageLabelEnAr(group.stageKey);
    const projectSlug = projectNameToSlug(group.projectName);
    const link = buildOverdueTasksPageUrl({
      project: projectSlug,
      stage: group.stageKey,
    });
    const dedupeKey = `unit-cycle-overdue-mgmt:${group.projectId}:${group.stageKey}:${dayKey}`;

    const created = await notifyRolesInboxTab({
      roles: ["MANAGEMENT", "SUPER_ADMIN"],
      inboxTab: "OVERDUE_TASKS",
      titleEn: "Overdue unit cycle stages",
      titleAr: "مراحل دورة وحدة متأخرة",
      messageEn: `${group.projectName}: ${group.unitCount} unit(s) overdue in ${stageLabels.en}`,
      messageAr: `${group.projectName}: ${group.unitCount} وحدة متأخرة في ${stageLabels.ar}`,
      link,
      dedupeKey,
    });

    notified += created;

    for (const row of group.rows) {
      await touchStageEscalation(prisma, row, now, dayKey);
    }
  }

  for (const ownerGroup of groupOverdueStagesForOwnerDigest(overdue)) {
    const count = ownerGroup.rows.length;
    const sample = ownerGroup.rows[0]!;
    const stageLabels = unitCycleStageLabelEnAr(sample.stageKey as UnitCycleStageKey);
    const link = buildOverdueTasksPageUrl({
      project: projectNameToSlug(sample.projectName),
      stage: sample.stageKey as UnitCycleStageKey,
    });
    const sent = await notifyUserInboxTab({
      userId: ownerGroup.userId,
      inboxTab: "OVERDUE_TASKS",
      titleEn: "Your overdue unit cycle tasks",
      titleAr: "مهام دورة الوحدة المتأخرة",
      messageEn: `${count} unit(s) overdue in ${stageLabels.en}`,
      messageAr: `${count} وحدة متأخرة في ${stageLabels.ar}`,
      link,
      dedupeKey: `unit-cycle-overdue-user:${ownerGroup.userId}:${dayKey}`,
    });
    if (sent) notified += 1;
  }

  return { notified, scanned: overdue.length };
}

async function touchStageEscalation(
  prisma: UnitCycleDb,
  row: OverdueStageRow,
  now: Date,
  dayKey: string
) {
  const stage = await prisma.unitCycleStage.findFirst({
    where: {
      unitCycleId: row.unitCycleId,
      stageKey: row.stageKey as never,
    },
    select: { id: true },
  });
  if (!stage) return;

  await prisma.unitCycleStage.update({
    where: { id: stage.id },
    data: { lastEscalatedAt: now },
  });

  await recordUnitCycleAuditEvent({
    unitCycleId: row.unitCycleId,
    stageKey: row.stageKey as never,
    action: "escalated_overdue",
    details: { daysOverdue: row.daysOverdue, digestDay: dayKey },
  });
}

export function getUnitCycleCronSchedule(): string {
  return process.env.UNIT_CYCLE_CRON ?? "0 8 * * *";
}
