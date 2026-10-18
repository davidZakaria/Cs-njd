import { resolveCsAgentScope } from "@/lib/auth/cs-agent-scope";
import { isCommunityManagementRole } from "@/lib/auth/unit-roles";
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

  for (const user of users) {
    if (user.role === "SUPER_ADMIN" || user.role === "MANAGEMENT") {
      recipientIds.add(user.id);
      continue;
    }

    if (isCommunityManagementRole(user.role)) {
      recipientIds.add(user.id);
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

function buildAnsweredCallCopy(
  actorName: string,
  unit: UnitContext,
  notes: string
): { titleEn: string; titleAr: string; messageEn: string; messageAr: string } {
  const clientName = unit.client?.name?.trim() || "—";
  const unitLabel = unit.unitCode;
  const outcome = callOutcomePhrase(parseCallLogOutcome(notes));

  return {
    titleEn: "Call answered",
    titleAr: "مكالمة تم الرد عليها",
    messageEn: `${actorName} logged an answered call (${outcome.en}) · Unit ${unitLabel} · ${clientName}`,
    messageAr: `${actorName} سجّل مكالمة تم الرد عليها (${outcome.ar}) · وحدة ${unitLabel} · ${clientName}`,
  };
}

/** Activity feed: answered call logs only (no cases / unanswered calls). */
export async function dispatchAnsweredCallLogActivity(input: {
  actorName: string;
  unit: UnitContext;
  notes: string;
}): Promise<void> {
  if (parseCallLogOutcome(input.notes) !== "answered") {
    return;
  }

  const recipientIds = await resolveRecipientUserIds(input.unit);
  if (recipientIds.length === 0) return;

  const copy = buildAnsweredCallCopy(input.actorName, input.unit, input.notes);
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
