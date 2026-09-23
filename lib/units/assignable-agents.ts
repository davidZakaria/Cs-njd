import { prisma } from "@/lib/prisma";
import { getAssignableAgentEmails } from "@/lib/staff";

export type AssignableAgentOption = {
  id: string;
  name: string;
};

export async function getAssignableAgentUsers(): Promise<AssignableAgentOption[]> {
  return prisma.user.findMany({
    where: { email: { in: getAssignableAgentEmails() } },
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
