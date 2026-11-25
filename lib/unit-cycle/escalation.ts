import type { Role, UnitCycleStageKey } from "@prisma/client";

import type { EscalationJobRunOptions } from "@/lib/cron/escalation-job-options";
import { projectNameToSlug } from "@/lib/cases/cases-filter-url";
import { resolveActiveUserIdsForRoles } from "@/lib/notifications/inbox-recipients";
import { buildOverdueTasksPageUrl } from "@/lib/unit-cycle/overdue-filter-url";
import { departmentOverdueHomePath } from "@/lib/unit-cycle/department-overdue";
import {
  groupOverdueStagesForDigest,
  groupOverdueStagesForOwnerDigest,
  groupOverdueStagesForDepartmentPoolDigest,
  formatOverdueDigestMessage,
} from "@/lib/unit-cycle/overdue-digest";
import { recordUnitCycleAuditEvent } from "@/lib/unit-cycle/audit";
import {
  getOverdueStagesForManagement,
  type OverdueStageRow,
  type UnitCycleDb,
} from "@/lib/unit-cycle/queries";
import { cairoCalendarDayKey } from "@/lib/format/datetime";
import {
  notifyRolesInboxTab,
  notifyUserInboxTab,
} from "@/lib/notifications/inbox-delivery";
import { unitCycleStageLabelEnAr } from "@/lib/unit-cycle/stage-labels";

export { groupOverdueStagesForDigest, groupOverdueStagesForOwnerDigest } from "@/lib/unit-cycle/overdue-digest";

export type UnitCycleEscalationPreview = {
  managementDigests: Array<{
    projectName: string;
    stageKey: UnitCycleStageKey;
    unitCodes: string[];
    recipientUserIds: string[];
  }>;
  ownerDigests: Array<{
    userId: string;
    unitCodes: string[];
  }>;
  departmentPoolDigests: Array<{
    department: Role;
    unitCodes: string[];
    recipientUserIds: string[];
  }>;
  wouldTouchStageCount: number;
};

export type UnitCycleEscalationJobResult = {
  scanned: number;
  notified: number;
  preview?: UnitCycleEscalationPreview;
};

function overdueInboxLinkForRole(role: Role): string {
  const basePath = departmentOverdueHomePath(role);
  if (basePath) {
    return buildOverdueTasksPageUrl({ department: role }, { basePath });
  }
  if (role === "OPERATIONS") {
    return "/operations";
  }
  return buildOverdueTasksPageUrl({});
}

export async function runUnitCycleEscalationJob(
  prisma: UnitCycleDb,
  options?: EscalationJobRunOptions
): Promise<UnitCycleEscalationJobResult> {
  const dryRun = options?.dryRun === true;
  const overdue = await getOverdueStagesForManagement(prisma, 500);
  const now = new Date();
  const dayKey = cairoCalendarDayKey(now);
  const groups = groupOverdueStagesForDigest(overdue);
  let notified = 0;

  const preview: UnitCycleEscalationPreview = {
    managementDigests: [],
    ownerDigests: [],
    departmentPoolDigests: [],
    wouldTouchStageCount: 0,
  };

  for (const group of groups) {
    if (dryRun) {
      preview.managementDigests.push({
        projectName: group.projectName,
        stageKey: group.stageKey,
        unitCodes: group.rows.map((row) => row.unitCode),
        recipientUserIds: await resolveActiveUserIdsForRoles(prisma, [
          "MANAGEMENT",
          "SUPER_ADMIN",
        ]),
      });
      preview.wouldTouchStageCount += group.rows.length;
    } else {
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
  }

  for (const ownerGroup of groupOverdueStagesForOwnerDigest(overdue)) {
    const digest = formatOverdueDigestMessage(ownerGroup.rows);
    const owner = await prisma.user.findFirst({
      where: { id: ownerGroup.userId, deletedAt: null },
      select: { role: true },
    });
    const link = overdueInboxLinkForRole(owner?.role ?? "MANAGEMENT");
    if (dryRun) {
      preview.ownerDigests.push({
        userId: ownerGroup.userId,
        unitCodes: ownerGroup.rows.map((row) => row.unitCode),
      });
    } else {
      const sent = await notifyUserInboxTab({
        userId: ownerGroup.userId,
        inboxTab: "OVERDUE_TASKS",
        titleEn: "Your overdue unit cycle tasks",
        titleAr: "مهام دورة الوحدة المتأخرة",
        messageEn: digest.en,
        messageAr: digest.ar,
        link,
        dedupeKey: `unit-cycle-overdue-user:${ownerGroup.userId}:${dayKey}`,
      });
      if (sent) notified += 1;
    }
  }

  for (const poolGroup of groupOverdueStagesForDepartmentPoolDigest(overdue)) {
    const digest = formatOverdueDigestMessage(poolGroup.rows);
    const link = overdueInboxLinkForRole(poolGroup.ownerRole);
    if (dryRun) {
      preview.departmentPoolDigests.push({
        department: poolGroup.ownerRole,
        unitCodes: poolGroup.rows.map((row) => row.unitCode),
        recipientUserIds: await resolveActiveUserIdsForRoles(prisma, [
          poolGroup.ownerRole,
        ]),
      });
    } else {
      const created = await notifyRolesInboxTab({
        roles: [poolGroup.ownerRole],
        inboxTab: "OVERDUE_TASKS",
        titleEn: "Unclaimed overdue tasks in your department",
        titleAr: "مهام متأخرة غير مُسنَدة في إدارتك",
        messageEn: digest.en,
        messageAr: digest.ar,
        link,
        dedupeKey: `unit-cycle-overdue-pool:${poolGroup.ownerRole}:${dayKey}`,
      });
      notified += created;
    }
  }

  return {
    notified: dryRun ? 0 : notified,
    scanned: overdue.length,
    ...(dryRun ? { preview } : {}),
  };
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
