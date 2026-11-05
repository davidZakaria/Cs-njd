import type { Role } from "@prisma/client";

import {
  isAdminUnitManager,
  isCsAgentRole,
  isLegalRole,
  isOperationsRole,
} from "@/lib/auth/unit-roles";

/** Legal/management edit draft text and generate watermarked PDFs from saved text. */
export function canEditOfficialDocumentDraftText(role: Role): boolean {
  return (
    isAdminUnitManager(role) ||
    isLegalRole(role) ||
    role === "SUPER_ADMIN"
  );
}

export function canGenerateOfficialDocuments(role: Role): boolean {
  return canEditOfficialDocumentDraftText(role);
}

export function canViewOfficialDocuments(role: Role): boolean {
  return (
    canEditOfficialDocumentDraftText(role) ||
    isCsAgentRole(role) ||
    isOperationsRole(role)
  );
}

export function canEditOfficialDocumentTemplates(role: Role): boolean {
  return isAdminUnitManager(role) || role === "SUPER_ADMIN";
}

export function isOfficialDocumentsFeatureEnabledForProject(input: {
  unitCycleEnabled: boolean;
}): boolean {
  return input.unitCycleEnabled;
}
