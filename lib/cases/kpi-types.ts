export type AgentKPIRow = {
  agentId: string;
  agentName: string;
  resolvedCount: number;
  avgResolutionDays: number | null;
  activityCount: number;
  overdueCount: number;
  staleCount: number;
  score: number;
};

export function sortAgentsForSlacking(rows: AgentKPIRow[]): AgentKPIRow[] {
  return [...rows].sort((a, b) => {
    const aRisk = a.overdueCount + a.staleCount;
    const bRisk = b.overdueCount + b.staleCount;
    if (bRisk !== aRisk) return bRisk - aRisk;
    if (b.staleCount !== a.staleCount) return b.staleCount - a.staleCount;
    return b.overdueCount - a.overdueCount;
  });
}

export function sortAgentsForLeaderboard(rows: AgentKPIRow[]): AgentKPIRow[] {
  return [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.resolvedCount !== a.resolvedCount) {
      return b.resolvedCount - a.resolvedCount;
    }
    return b.activityCount - a.activityCount;
  });
}
