import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

/** Preview logins see the same units/cases as the mapped staff agent. */
export const CS_AGENT_PREVIEW_AS: Readonly<Record<string, string>> = {
  [(
    process.env.CS_PREVIEW_LOGIN_EMAIL ?? "davidsamii3@gmail.com"
  ).toLowerCase()]: (
    process.env.CS_PREVIEW_SOURCE_EMAIL ?? "islam.tharwat@newjerseyegypt.com"
  ).toLowerCase(),
};

export type CsAgentScope = {
  loginUserId: string;
  effectiveAgentId: string;
  isPreview: boolean;
  previewSourceEmail?: string;
};

export type SessionUserForScope = {
  id: string;
  email?: string | null;
  role: Role;
};

export async function resolveCsAgentScope(
  user: SessionUserForScope
): Promise<CsAgentScope> {
  if (user.role !== "CS_AGENT") {
    return {
      loginUserId: user.id,
      effectiveAgentId: user.id,
      isPreview: false,
    };
  }

  const loginEmail = user.email?.trim().toLowerCase() ?? "";
  const sourceEmail = CS_AGENT_PREVIEW_AS[loginEmail];

  if (!sourceEmail) {
    return {
      loginUserId: user.id,
      effectiveAgentId: user.id,
      isPreview: false,
    };
  }

  const source = await prisma.user.findUnique({
    where: { email: sourceEmail },
    select: { id: true },
  });

  if (!source) {
    return {
      loginUserId: user.id,
      effectiveAgentId: user.id,
      isPreview: false,
      previewSourceEmail: sourceEmail,
    };
  }

  return {
    loginUserId: user.id,
    effectiveAgentId: source.id,
    isPreview: true,
    previewSourceEmail: sourceEmail,
  };
}

export function canAccessUnitAsCsAgent(
  scope: CsAgentScope,
  unitAgentId: string | null | undefined
): boolean {
  return unitAgentId === scope.effectiveAgentId;
}

export function csAgentTicketScope(scope: CsAgentScope) {
  return {
    OR: [
      { agentId: scope.effectiveAgentId },
      { unit: { agentId: scope.effectiveAgentId } },
    ],
  };
}

export function csAgentUnitScope(scope: CsAgentScope) {
  return { agentId: scope.effectiveAgentId };
}
