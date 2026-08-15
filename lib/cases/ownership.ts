/** Ticket or unit is personally owned by this user (manager or CS agent). */
export function isCaseOwnedByUser(
  ticketAgentId: string | null | undefined,
  unitAgentId: string | null | undefined,
  userId: string
): boolean {
  return ticketAgentId === userId || unitAgentId === userId;
}

export function getEffectiveCaseAgent(
  ticketAgentId: string | null | undefined,
  ticketAgentName: string | null | undefined,
  unitAgentId: string | null | undefined,
  unitAgentName: string | null | undefined
) {
  if (ticketAgentId) {
    return { id: ticketAgentId, name: ticketAgentName ?? "" };
  }
  if (unitAgentId) {
    return { id: unitAgentId, name: unitAgentName ?? "" };
  }
  return { id: null, name: "" };
}

export function splitCasesForManager<
  T extends { agentId: string | null; unitAgentId: string | null }
>(rows: T[], managerId: string) {
  const mine: T[] = [];
  const team: T[] = [];

  for (const row of rows) {
    if (isCaseOwnedByUser(row.agentId, row.unitAgentId, managerId)) {
      mine.push(row);
    } else {
      team.push(row);
    }
  }

  return { mine, team };
}
