/** Select value for filtering rows with no assigned agent. */
export const UNASSIGNED_AGENT_FILTER = "filter-unassigned";

export function isUnassignedAgentName(name: string | null | undefined): boolean {
  return !name || name === "-" || name === "—";
}
