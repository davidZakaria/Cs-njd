import type { CallLogOutcome } from "@prisma/client";

import { resolveCsAgentScope } from "@/lib/auth/cs-agent-scope";
import { isCommunityManagementRole } from "@/lib/auth/unit-roles";
import {
  callOutcomePhrase,
  resolveCallOutcome,
  type CallOutcome,
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

function titleForOutcome(outcome: CallOutcome): { en: string; ar: string } {
  switch (outcome) {
    case "answered":
      return { en: "Call answered", ar: "مكالمة تم الرد عليها" };
    case "not_answered":
      return { en: "Call not answered", ar: "مكالمة دون رد" };
    default:
      return { en: "Call logged", ar: "مكالمة مسجّلة" };
  }
}

function buildCallLogCopy(
  actorName: string,
  unit: UnitContext,
  notes: string,
  outcome: CallOutcome
): { titleEn: string; titleAr: string; messageEn: string; messageAr: string } {
  const clientName = unit.client?.name?.trim() || "—";
  const unitLabel = unit.unitCode;
  const outcomeLabel = callOutcomePhrase(outcome);
  const snippet = notesSnippet(notes);

  const title = titleForOutcome(outcome);

  return {
    titleEn: title.en,
    titleAr: title.ar,
    messageEn: `${actorName} · ${outcomeLabel.en} · Unit ${unitLabel} · ${clientName}${snippet ? ` · ${snippet}` : ""}`,
    messageAr: `${actorName} · ${outcomeLabel.ar} · وحدة ${unitLabel} · ${clientName}${snippet ? ` · ${snippet}` : ""}`,
  };
}

/** Activity feed: all logged calls (CALL_LOG inbox tab). */
export async function dispatchCallLogActivity(input: {
  actorUserId: string;
  actorName: string;
  unit: UnitContext;
  notes: string;
  callLogOutcome: CallLogOutcome | null;
}): Promise<void> {
  const outcome = resolveCallOutcome(input.callLogOutcome, input.notes);
  const recipientIds = (await resolveRecipientUserIds(input.unit)).filter(
    (id) => id !== input.actorUserId
  );
  if (recipientIds.length === 0) return;

  const copy = buildCallLogCopy(
    input.actorName,
    input.unit,
    input.notes,
    outcome
  );
  const link = activityLink(input.unit.id);

  await basePrisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      kind: "ACTIVITY",
      inboxTab: "CALL_LOG",
      title: encodeBilingual(copy.titleEn, copy.titleAr),
      message: encodeBilingual(copy.messageEn, copy.messageAr),
      link,
    })),
  });
}