import type { PrismaClient } from "@prisma/client";

import type { EscalationJobRunOptions } from "@/lib/cron/escalation-job-options";
import { APP_DISPLAY_TIME_ZONE, cairoCalendarDayKey } from "@/lib/format/datetime";
import { notifyUserInboxTab } from "@/lib/notifications/inbox-delivery";
import { recordRequestAuditEvent } from "@/lib/requests/audit";
import { resolveLateRequestWatcherUserIds } from "@/lib/requests/late-request-watchers";
import { isRequestOverdue } from "@/lib/requests/overdue";
import {
  formatLateRequestDigestMessage,
  groupLateRequestsForDigest,
} from "@/lib/requests/overdue-digest";
import { buildRequestsFilterUrl } from "@/lib/requests/requests-filter-url";
import type { UnitRequestListRow } from "@/lib/requests/types";
import { unitRequestViewerLinkForRole } from "@/lib/requests/viewer-link";
import { formatUnitOwnersDisplayName } from "@/lib/units/unit-request-search";

export const REQUEST_ESCALATION_CRON_TIMEZONE = APP_DISPLAY_TIME_ZONE;

export type RequestEscalationPreview = {
  wouldEscalateRequestIds: string[];
  approverNotifications: Array<{
    userId: string;
    requestId: string;
    unitCode: string;
  }>;
  watcherDigestUserIds: string[];
  skippedCooldownRequestIds: string[];
};

export type RequestEscalationJobResult = {
  scanned: number;
  notified: number;
  preview?: RequestEscalationPreview;
};

export type RequestEscalationDb = Pick<
  PrismaClient,
  "unitRequest" | "user" | "systemSetting"
>;

const listInclude = {
  requestedBy: { select: { id: true, name: true } },
  unit: {
    select: {
      id: true,
      unitCode: true,
      agentId: true,
      project: { select: { name: true } },
      client: { select: { name: true } },
      unitClients: {
        orderBy: [{ role: "asc" as const }, { position: "asc" as const }],
        select: { role: true, client: { select: { name: true } } },
      },
    },
  },
};

export async function getOverduePendingRequests(
  prisma: RequestEscalationDb,
  limit: number
): Promise<UnitRequestListRow[]> {
  const now = new Date();
  const rows = await prisma.unitRequest.findMany({
    where: {
      deletedAt: null,
      status: "PENDING",
      dueDate: { lt: now },
    },
    take: limit,
    orderBy: { dueDate: "asc" },
    include: listInclude,
  });

  return rows
    .filter(
      (row): row is typeof row & { unit: NonNullable<(typeof row)["unit"]> } =>
        row.unit != null
    )
    .map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      dueDate: row.dueDate,
      submittedAt: row.submittedAt,
      currentApproverKind: row.currentApproverKind,
      escalatedToManagement: row.escalatedToManagement,
      assignedApproverUserId: row.assignedApproverUserId,
      requestedById: row.requestedById,
      requestedByName: row.requestedBy.name,
      unitId: row.unit.id,
      unitCode: row.unit.unitCode,
      projectName: row.unit.project.name,
      clientName: formatUnitOwnersDisplayName({
        client: row.unit.client,
        unitClients: row.unit.unitClients,
      }),
      unitAgentId: row.unit.agentId,
      unitCycleStageKey: row.unitCycleStageKey,
    }));
}

export async function runRequestEscalationJob(
  prisma: RequestEscalationDb,
  options?: EscalationJobRunOptions
): Promise<RequestEscalationJobResult> {
  const dryRun = options?.dryRun === true;
  const ESCALATION_COOLDOWN_MS = 20 * 60 * 60 * 1000;
  const overdue = await getOverduePendingRequests(prisma, 500);
  const now = new Date();
  const dayKey = cairoCalendarDayKey(now);
  let notified = 0;

  const preview: RequestEscalationPreview = {
    wouldEscalateRequestIds: [],
    approverNotifications: [],
    watcherDigestUserIds: [],
    skippedCooldownRequestIds: [],
  };

  const overdueRows = overdue.filter((row) =>
    isRequestOverdue({ status: row.status, dueDate: row.dueDate, now })
  );

  for (const row of overdueRows) {
    const record = await prisma.unitRequest.findUnique({
      where: { id: row.id },
      select: { lastEscalatedAt: true },
    });
    if (
      record?.lastEscalatedAt &&
      now.getTime() - record.lastEscalatedAt.getTime() < ESCALATION_COOLDOWN_MS
    ) {
      if (dryRun) {
        preview.skippedCooldownRequestIds.push(row.id);
      }
      continue;
    }

    if (row.assignedApproverUserId) {
      const assignee = await prisma.user.findUnique({
        where: { id: row.assignedApproverUserId },
        select: { role: true },
      });
      const viewerLink = unitRequestViewerLinkForRole(
        assignee?.role ?? "MANAGEMENT",
        row.id,
        row.type
      );

      if (dryRun) {
        preview.approverNotifications.push({
          userId: row.assignedApproverUserId,
          requestId: row.id,
          unitCode: row.unitCode,
        });
      } else {
        const sent = await notifyUserInboxTab({
          userId: row.assignedApproverUserId,
          inboxTab: "REQUESTS_AND_FILES",
          titleEn: "Overdue unit request",
          titleAr: "طلب وحدة متأخر",
          messageEn: `${row.projectName} · ${row.unitCode} · ${row.type}`,
          messageAr: `${row.projectName} · ${row.unitCode} · ${row.type}`,
          link: viewerLink,
          dedupeKey: `request-overdue:${row.id}:${dayKey}`,
        });
        if (sent) notified += 1;
      }
    }

    if (dryRun) {
      preview.wouldEscalateRequestIds.push(row.id);
    } else {
      await prisma.unitRequest.update({
        where: { id: row.id },
        data: {
          escalatedToManagement: true,
          lastEscalatedAt: now,
        },
      });

      await recordRequestAuditEvent({
        requestId: row.id,
        action: "escalated_overdue",
        details: {
          daysOverdue: row.dueDate
            ? Math.floor((now.getTime() - row.dueDate.getTime()) / 86_400_000)
            : 0,
        },
      });
    }
  }

  if (overdueRows.length > 0) {
    const groups = groupLateRequestsForDigest(overdueRows, now);
    const digest = formatLateRequestDigestMessage(groups);
    const watcherIds = await resolveLateRequestWatcherUserIds(prisma);
    const link = buildRequestsFilterUrl({ view: "all", overdue: "yes", tasks: "all" });

    if (dryRun) {
      preview.watcherDigestUserIds = watcherIds;
    } else {
      for (const userId of watcherIds) {
        const sent = await notifyUserInboxTab({
          userId,
          inboxTab: "REQUESTS_AND_FILES",
          titleEn: digest.titleEn,
          titleAr: digest.titleAr,
          messageEn: digest.messageEn,
          messageAr: digest.messageAr,
          link,
          dedupeKey: `late-request-digest:${userId}:${dayKey}`,
        });
        if (sent) notified += 1;
      }
    }
  }

  return {
    notified: dryRun ? 0 : notified,
    scanned: overdue.length,
    ...(dryRun ? { preview } : {}),
  };
}

export function getRequestEscalationCronSchedule(): string {
  return process.env.REQUEST_ESCALATION_CRON ?? "0 10 * * *";
}

export function getRequestEscalationCronTimezone(): string {
  return process.env.REQUEST_ESCALATION_CRON_TZ ?? REQUEST_ESCALATION_CRON_TIMEZONE;
}