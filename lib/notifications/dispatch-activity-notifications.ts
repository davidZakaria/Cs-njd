import { resolveCsAgentScope } from "@/lib/auth/cs-agent-scope";
import { isCommunityManagedProject } from "@/lib/auth/community-project-scope";
import { isCommunityManagementRole } from "@/lib/auth/unit-roles";
import { isCommunityCallLog } from "@/lib/services/community-tracker";
import {
  callOutcomePhrase,
  parseCallLogOutcome,
} from "@/lib/notifications/call-outcome";
import { encodeBilingual } from "@/lib/notifications/bilingual";
import { basePrisma } from "@/lib/prisma";

type UnitContext = {
  id: string;
  unitCode: string;
  agentId: string | null;
  projectId: string;
  project: { id: string; name: string };
  client?: { name: string | null } | null;
};

type ActivityKind = "call_log" | "ticket_created";

function activityLink(unitId: string): string {
  return `/units/${unitId}?tab=timeline`;
}

async function resolveRecipientUserIds(unit: UnitContext): Promise<string[]> {
  const users = await basePrisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      role: {
        in: ["SUPER_ADMIN", "MANAGEMENT", "CS_AGENT", "COMMUNITY_MANAGEMENT"],
      },
    },
    select: { id: true, role: true, email: true },
  });

  const recipientIds = new Set<string>();
  const jamila = isCommunityManagedProject(unit.project);

  for (const user of users) {
    if (user.role === "SUPER_ADMIN" || user.role === "MANAGEMENT") {
      recipientIds.add(user.id);
      continue;
    }

    if (isCommunityManagementRole(user.role)) {
      if (jamila) recipientIds.add(user.id);
      continue;
    }

    if (user.role === "CS_AGENT") {
      const scope = await resolveCsAgentScope({
        id: user.id,
        email: user.email,
        role: user.role,
      });
      if (unit.agentId && scope.effectiveAgentId === unit.agentId) {
        recipientIds.add(user.id);
      }
    }
  }

  return [...recipientIds];
}

function buildActivityCopy(
  kind: ActivityKind,
  actorName: string,
  unit: UnitContext,
  notes: string
): { titleEn: string; titleAr: string; messageEn: string; messageAr: string } {
  const clientName = unit.client?.name?.trim() || "—";
  const unitLabel = unit.unitCode;

  if (kind === "call_log") {
    const outcome = callOutcomePhrase(parseCallLogOutcome(notes));
    return {
      titleEn: "Call logged",
      titleAr: "تسجيل مكالمة",
      messageEn: `${actorName} logged a call (${outcome.en}) · Unit ${unitLabel} · ${clientName}`,
      messageAr: `${actorName} سجّل مكالمة (${outcome.ar}) · وحدة ${unitLabel} · ${clientName}`,
    };
  }

  return {
    titleEn: "New case opened",
    titleAr: "تذكرة جديدة",
    messageEn: `${actorName} opened a case · Unit ${unitLabel} · ${clientName}`,
    messageAr: `${actorName} فتح تذكرة · وحدة ${unitLabel} · ${clientName}`,
  };
}

export async function dispatchActivityNotification(input: {
  kind: ActivityKind;
  actorUserId: string;
  actorName: string;
  unit: UnitContext;
  notes: string;
}): Promise<void> {
  const recipientIds = await resolveRecipientUserIds(input.unit);
  if (recipientIds.length === 0) return;

  const copy = buildActivityCopy(
    input.kind,
    input.actorName,
    input.unit,
    input.notes
  );
  const link = activityLink(input.unit.id);

  await basePrisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      kind: "ACTIVITY",
      title: encodeBilingual(copy.titleEn, copy.titleAr),
      message: encodeBilingual(copy.messageEn, copy.messageAr),
      link,
    })),
  });
}

export async function dispatchActivityForTicketCreate(input: {
  actorUserId: string;
  actorName: string;
  unit: UnitContext;
  category: string;
  notes: string;
}): Promise<void> {
  if (isCommunityCallLog(input.category as never, input.notes)) {
    await dispatchActivityNotification({
      kind: "call_log",
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      unit: input.unit,
      notes: input.notes,
    });
    return;
  }

  await dispatchActivityNotification({
    kind: "ticket_created",
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    unit: input.unit,
    notes: input.notes,
  });
}
