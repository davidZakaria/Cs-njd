import type { Role } from "@prisma/client";

import type { CsAgentScope } from "@/lib/auth/cs-agent-scope";
import { canAccessUnitAsCsAgent } from "@/lib/auth/cs-agent-scope";
import {
  isCommunityManagedProject,
  type ProjectRef,
} from "@/lib/auth/community-project-scope";
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
  _scope?: CsAgentScope | null,
  project?: ProjectRef | null
): boolean {
  if (isCommunityManagementRole(role)) {
    return project != null && isCommunityManagedProject(project);
  }
  if (isCsAgentRole(role)) return true;
  if (isAdminUnitManager(role) || role === "SUPER_ADMIN") return true;
  return false;
}

export function canCommunityActOnUnit(project: ProjectRef): boolean {
  return isCommunityManagedProject(project);
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

/** Primary phone/address and extra phones/addresses (not client identity). */
export function canEditClientPhonesAndAddressesOnUnit(
  role: Role,
  _assignment?: UnitAssignment,
  _scope?: CsAgentScope | null
): boolean {
  if (isAdminUnitManager(role)) return true;
  if (isCsAgentRole(role)) return true;
  return false;
}

/** @deprecated Prefer canEditClientPhonesAndAddressesOnUnit */
export function canEditClientContactsOnUnit(
  role: Role,
  assignment?: UnitAssignment,
  scope?: CsAgentScope | null
): boolean {
  return canEditClientPhonesAndAddressesOnUnit(role, assignment, scope);
}

export function canEditClientIdentityFields(role: Role): boolean {
  return isAdminUnitManager(role);
}

export function canUploadClientNationalIdScan(role: Role): boolean {
  return isAdminUnitManager(role);
}

/** Full add/edit/remove of extra phones and addresses (unit profile save). */
export function canSyncClientExtraContacts(
  role: Role,
  assignment: UnitAssignment,
  scope?: CsAgentScope | null
): boolean {
  return canEditClientPhonesAndAddressesOnUnit(role, assignment, scope);
}

export function canAddCommunityExtraContactsOnly(role: Role): boolean {
  return isCommunityManagementRole(role);
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

/** Full Legal & Handover checklist (management form) on the unit profile. */
export function canEditLegalHandoverOnUnit(
  role: Role,
  project?: ProjectRef | null
): boolean {
  if (isAdminUnitManager(role) || role === "SUPER_ADMIN") return true;
  if (isCommunityManagementRole(role)) {
    return project != null && isCommunityManagedProject(project);
  }
  return false;
}

/** Finishing financials tab — all fields on the unit profile. */
export function canEditFinishingFinancialsOnUnit(
  role: Role,
  _assignment?: UnitAssignment,
  _scope?: CsAgentScope | null,
  project?: ProjectRef | null
): boolean {
  if (isAdminUnitManager(role) || role === "SUPER_ADMIN") return true;
  if (isCommunityManagementRole(role)) {
    return project != null && isCommunityManagedProject(project);
  }
  if (isCsAgentRole(role)) return true;
  return false;
}

export function canAccessEngineeringPortal(role: Role): boolean {
  return role === "ENGINEER";
}

/** Site engineer return-to-CS workflow — engineer account only. */
export function canSubmitEngineeringSiteUpdate(role: Role): boolean {
  return role === "ENGINEER";
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
