import type { Role, UnitCycleStageKey } from "@prisma/client";

/** Contract workflow stays with management; finance/legal stages use dedicated roles when present. */
export function resolveStageOwnerRole(stageKey: UnitCycleStageKey): Role {
  switch (stageKey) {
    case "CONTRACT":
      return "MANAGEMENT";
    case "FINANCE":
      return "FINANCE";
    case "LEGAL_HANDOVER":
      return "LEGAL";
    case "ENGINEERING":
      return "CS_AGENT";
    default:
      return "MANAGEMENT";
  }
}

export function managementRolesForCycle(): Role[] {
  return ["MANAGEMENT", "SUPER_ADMIN"];
}

export function roleCanOwnStage(
  userRole: Role,
  stageKey: UnitCycleStageKey
): boolean {
  if (managementRolesForCycle().includes(userRole)) {
    return true;
  }
  const owner = resolveStageOwnerRole(stageKey);
  return userRole === owner;
}

/** Whether this viewer is the designated owner for a stage (ignores management override). */
export function viewerOwnsStageByRole(
  userRole: Role,
  stageKey: UnitCycleStageKey,
  opts?: { unitAgentId: string | null; userId?: string | null }
): boolean {
  if (userRole === "CS_AGENT") {
    return (
      stageKey === "ENGINEERING" &&
      Boolean(opts?.userId) &&
      opts?.unitAgentId === opts?.userId
    );
  }
  if (managementRolesForCycle().includes(userRole)) {
    return stageKey === "CONTRACT";
  }
  return userRole === resolveStageOwnerRole(stageKey);
}
