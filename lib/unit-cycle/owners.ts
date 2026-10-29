import type { Role, UnitCycleStageKey } from "@prisma/client";

/** Contract/Legal workflow parties map to management when no dedicated login role exists. */
export function resolveStageOwnerRole(stageKey: UnitCycleStageKey): Role {
  switch (stageKey) {
    case "CONTRACT":
    case "FINANCE":
    case "LEGAL_HANDOVER":
      return "MANAGEMENT";
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
  const owner = resolveStageOwnerRole(stageKey);
  if (owner === "MANAGEMENT") {
    return managementRolesForCycle().includes(userRole);
  }
  return userRole === owner;
}
