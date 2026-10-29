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

export function isOperationsRole(role: Role): boolean {
  return role === "OPERATIONS";
}

export function isLimitedExportRole(role: Role): boolean {
  return (
    isCsAgentRole(role) ||
    isCommunityManagementRole(role) ||
    isOperationsRole(role)
  );
}

export type UnitClientEditMode =
  | "none"
  | "communityExtras"
  | "phoneAddress"
  | "admin";

export function resolveUnitClientEditMode(role: Role): UnitClientEditMode {
  if (isAdminUnitManager(role)) return "admin";
  if (isCsAgentRole(role)) return "phoneAddress";
  if (isCommunityManagementRole(role)) return "communityExtras";
  return "none";
}

/** @deprecated Use resolveUnitClientEditMode */
export function canEditClientContactOnUnit(role: Role): boolean {
  const mode = resolveUnitClientEditMode(role);
  return mode === "phoneAddress" || mode === "admin";
}

export function canAddCommunityExtraContact(role: Role): boolean {
  return isCommunityManagementRole(role);
}
