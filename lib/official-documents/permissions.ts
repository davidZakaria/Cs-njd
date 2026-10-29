import type { Role } from "@prisma/client";

import {
  isAdminUnitManager,
  isCsAgentRole,
  isOperationsRole,
} from "@/lib/auth/unit-roles";

export function canGenerateOfficialDocuments(role: Role): boolean {
  return (
    isCsAgentRole(role) ||
    isAdminUnitManager(role) ||
    role === "SUPER_ADMIN"
  );
}

export function canViewOfficialDocuments(role: Role): boolean {
  return canGenerateOfficialDocuments(role) || isOperationsRole(role);
}

export function canEditOfficialDocumentTemplates(role: Role): boolean {
  return isAdminUnitManager(role) || role === "SUPER_ADMIN";
}

export function isOfficialDocumentsFeatureEnabledForProject(input: {
  unitCycleEnabled: boolean;
}): boolean {
  return input.unitCycleEnabled;
}
