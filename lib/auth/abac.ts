import type { Role } from "@prisma/client";

import { actionFail, type ActionResult } from "@/lib/actions/result";
import { isCaseOwnedByUser } from "@/lib/cases/ownership";
import {
  canAccessUnitAsCsAgent,
  resolveCsAgentScope,
  type SessionUserForScope,
} from "@/lib/auth/cs-agent-scope";
import { canManageUnitTickets } from "@/lib/auth/unit-ticket-access";

export async function assertCsAgentCanMutateTicket(
  user: SessionUserForScope,
  ticket: { agentId: string | null; unit: { agentId: string | null } }
): Promise<ActionResult | null> {
  if (canManageUnitTickets(user)) {
    return null;
  }

  if (user.role !== "CS_AGENT") {
    return actionFail("Unauthorized");
  }

  const scope = await resolveCsAgentScope(user);
  if (
    !isCaseOwnedByUser(
      ticket.agentId,
      ticket.unit.agentId,
      scope.effectiveAgentId
    )
  ) {
    return actionFail("Unauthorized");
  }

  return null;
}

export async function assertCsAgentUnitAccess(
  user: SessionUserForScope,
  unitAgentId: string | null | undefined
): Promise<ActionResult | null> {
  if (user.role !== "CS_AGENT") {
    return null;
  }

  const scope = await resolveCsAgentScope(user);
  if (!canAccessUnitAsCsAgent(scope, unitAgentId)) {
    return actionFail("Unauthorized");
  }

  return null;
}

export function isPrivilegedRole(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "MANAGEMENT";
}
