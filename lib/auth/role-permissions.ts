import type { Role } from "@prisma/client";

import type { CsAgentScope } from "@/lib/auth/cs-agent-scope";
import { canAccessUnitAsCsAgent } from "@/lib/auth/cs-agent-scope";
import {
  isAdminUnitManager,
  isCommunityManagementRole,
  isCsAgentRole,
} from "@/lib/auth/unit-roles";

export type UnitAssignment = {
  unitAgentId: string | null | undefined;
};

export function isCsAgentAssignedToUnit(
  scope: CsAgentScope,
  unit: UnitAssignment
): boolean {
  return canAccessUnitAsCsAgent(scope, unit.unitAgentId);
}

/** CS agents may open any unit profile; other roles use route RBAC. */
export function canViewUnitProfile(role: Role): boolean {
  if (isCsAgentRole(role) || isCommunityManagementRole(role)) return true;
  return (
    isAdminUnitManager(role) ||
    role === "SUPER_ADMIN" ||
    role === "ENGINEER"
  );
}

export function canListAllUnits(role: Role): boolean {
  return isCsAgentRole(role) || isCommunityManagementRole(role);
}

export function canLogCallOnUnit(
  role: Role,
  _assignment?: UnitAssignment,
  _scope?: CsAgentScope | null
): boolean {
  if (isCommunityManagementRole(role)) return true;
  if (isCsAgentRole(role)) return true;
  if (isAdminUnitManager(role) || role === "SUPER_ADMIN") return true;
  return false;
}

export function canCreateOrUpdateCaseOnUnit(
  role: Role,
  assignment: UnitAssignment,
  scope?: CsAgentScope | null
): boolean {
  if (isCommunityManagementRole(role)) return false;
  if (isAdminUnitManager(role) || role === "SUPER_ADMIN") return true;
  if (isCsAgentRole(role) && scope) {
    return isCsAgentAssignedToUnit(scope, assignment);
  }
  return false;
}

export function canEditClientContactsOnUnit(
  role: Role,
  assignment: UnitAssignment,
  scope?: CsAgentScope | null
): boolean {
  if (isAdminUnitManager(role)) return true;
  if (isCsAgentRole(role) && scope) {
    return isCsAgentAssignedToUnit(scope, assignment);
  }
  return false;
}

export function canEditCsHandoverChecklist(
  role: Role,
  assignment: UnitAssignment,
  scope?: CsAgentScope | null
): boolean {
  if (isAdminUnitManager(role)) return true;
  if (isCommunityManagementRole(role)) return false;
  if (isCsAgentRole(role) && scope) {
    return isCsAgentAssignedToUnit(scope, assignment);
  }
  return false;
}

/** Finishing fees, contract dates, phases — management only. */
export function canEditFinishingFinancials(role: Role): boolean {
  return isAdminUnitManager(role);
}

/** Engineering notes / custom modifications on the unit profile. */
export function canEditCsFinishingEngineering(
  role: Role,
  assignment: UnitAssignment,
  scope?: CsAgentScope | null
): boolean {
  if (isCommunityManagementRole(role)) return false;
  if (isAdminUnitManager(role)) return true;
  if (isCsAgentRole(role) && scope) {
    return isCsAgentAssignedToUnit(scope, assignment);
  }
  return false;
}

export function canAccessEngineeringPortal(role: Role): boolean {
  return role === "ENGINEER" || isCsAgentRole(role);
}

/** Site engineer return-to-CS workflow — engineer account only. */
export function canSubmitEngineeringSiteUpdate(role: Role): boolean {
  return role === "ENGINEER";
}

export function canViewEngineeringUnitTask(
  role: Role,
  _assignment?: UnitAssignment,
  _scope?: CsAgentScope | null
): boolean {
  if (role === "ENGINEER") return true;
  if (isCsAgentRole(role)) return true;
  if (isAdminUnitManager(role) || role === "SUPER_ADMIN") return true;
  return false;
}

export function canMutateEngineeringQueueAsCs(
  role: Role,
  assignment: UnitAssignment,
  scope?: CsAgentScope | null
): boolean {
  return canEditCsFinishingEngineering(role, assignment, scope);
}

export function canReassignAgents(role: Role): boolean {
  return isAdminUnitManager(role);
}

export function canDeleteRecords(role: Role): boolean {
  return isAdminUnitManager(role) || role === "SUPER_ADMIN";
}

export function canAccessImportsOrUserAdmin(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "MANAGEMENT";
}
