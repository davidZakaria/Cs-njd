import type { Role } from "@prisma/client";

import {
  isAdminUnitManager,
  isCsAgentRole,
  isDepartmentStaffRole,
  isOperationsRole,
} from "@/lib/auth/unit-roles";

/** Client ID scan, finishing contract, and ملحق المد — CS on any unit; management/super admin; operations archive upload. */
export function canAccessCsPortfolioDocuments(role: Role): boolean {
  return (
    isCsAgentRole(role) ||
    isAdminUnitManager(role) ||
    role === "SUPER_ADMIN" ||
    isOperationsRole(role)
  );
}

/** Read/download portfolio files without granting upload rights. */
export function canViewUnitPortfolioDocuments(role: Role): boolean {
  return canAccessCsPortfolioDocuments(role) || isDepartmentStaffRole(role);
}

/** Replace or delete portfolio document files (not initial CS upload). */
export function canManageCsPortfolioDocumentFiles(role: Role): boolean {
  return isAdminUnitManager(role) || role === "SUPER_ADMIN";
}
