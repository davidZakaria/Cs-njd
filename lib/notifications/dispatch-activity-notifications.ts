import { resolveCsAgentScope } from "@/lib/auth/cs-agent-scope";
import { isCommunityManagementRole } from "@/lib/auth/unit-roles";
import { callLogDedupeKey } from "@/lib/notifications/call-log-dedupe";
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

function notesSnippet(notes: string, maxLen = 120): string {
  const trimmed = notes.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
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

  if (unit.agentId) {
    recipientIds.add(unit.agentId);
  }

  return [...recipientIds];
}

function buildCallLogCopy(
  actorName: string,
  unit: UnitContext,
  notes: string
): { titleEn: string; titleAr: string; messageEn: string; messageAr: string } {
  const clientName = unit.client?.name?.trim() || "—";
  const unitLabel = unit.unitCode;
  const snippet = notesSnippet(notes);

  return {
    titleEn: "Call logged",
    titleAr: "مكالمة مسجّلة",
    messageEn: `${actorName} · Unit ${unitLabel} · ${clientName}${snippet ? ` · ${snippet}` : ""}`,
    messageAr: `${actorName} · وحدة ${unitLabel} · ${clientName}${snippet ? ` · ${snippet}` : ""}`,
  };
}

/** Activity feed: every logged call (CALL_LOG inbox tab). */
export async function dispatchCallLogActivity(input: {
  actorUserId: string;
  actorName: string;
  unit: UnitContext;
  notes: string;
  ticketId: string;
}): Promise<void> {
  const recipientIds = (await resolveRecipientUserIds(input.unit)).filter(
    (id) => id !== input.actorUserId
  );
  if (recipientIds.length === 0) return;

  const copy = buildCallLogCopy(input.actorName, input.unit, input.notes);
  const link = activityLink(input.unit.id);
  const dedupeKey = callLogDedupeKey(input.ticketId);

  await basePrisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      kind: "ACTIVITY",
      inboxTab: "CALL_LOG",
      dedupeKey,
      title: encodeBilingual(copy.titleEn, copy.titleAr),
      message: encodeBilingual(copy.messageEn, copy.messageAr),
      link,
    })),
  });
}