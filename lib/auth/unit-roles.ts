import type { Role } from "@prisma/client";

export function isAdminUnitManager(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "MANAGEMENT";
}

export function isCsAgentRole(role: Role): boolean {
  return role === "CS_AGENT";
}

export function isCommunityManagementRole(role: Role): boolean {
  return role === "COMMUNITY_MANAGEMENT";
}

export function isLimitedExportRole(role: Role): boolean {
  return isCsAgentRole(role) || isCommunityManagementRole(role);
}

export type UnitClientEditMode = "none" | "communityExtras" | "contact" | "admin";

export function resolveUnitClientEditMode(
  role: Role,
  csAgentHasUnitAccess: boolean
): UnitClientEditMode {
  if (isAdminUnitManager(role)) return "admin";
  if (isCsAgentRole(role) && csAgentHasUnitAccess) return "contact";
  if (isCommunityManagementRole(role)) return "communityExtras";
  return "none";
}

/** @deprecated Use resolveUnitClientEditMode */
export function canEditClientContactOnUnit(
  role: Role,
  csAgentHasUnitAccess: boolean
): boolean {
  const mode = resolveUnitClientEditMode(role, csAgentHasUnitAccess);
  return mode === "contact" || mode === "admin";
}

export function canAddCommunityExtraContact(role: Role): boolean {
  return isCommunityManagementRole(role);
}
