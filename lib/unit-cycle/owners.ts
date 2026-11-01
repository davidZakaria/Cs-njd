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
