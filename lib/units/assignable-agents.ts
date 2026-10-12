import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AssignableAgentOption = {
  id: string;
  name: string;
};

/** Active CS agents and management — anyone who may own a unit or case. */
export const assignableAgentUserWhere: Prisma.UserWhereInput = {
  deletedAt: null,
  isActive: true,
  role: { in: ["CS_AGENT", "MANAGEMENT"] },
};

export async function getAssignableAgentUsers(): Promise<AssignableAgentOption[]> {
  return prisma.user.findMany({
    where: assignableAgentUserWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export function isValidUnitAgentId(
  agentId: string | null | undefined,
  assignableAgents: readonly AssignableAgentOption[]
): boolean {
  if (!agentId) return true;
  return assignableAgents.some((agent) => agent.id === agentId);
}
