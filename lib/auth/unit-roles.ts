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

export function canEditClientContactOnUnit(
  role: Role,
  csAgentHasUnitAccess: boolean
): boolean {
  if (isAdminUnitManager(role)) return true;
  if (isCommunityManagementRole(role)) return true;
  if (isCsAgentRole(role)) return csAgentHasUnitAccess;
  return false;
}
