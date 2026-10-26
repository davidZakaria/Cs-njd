import type { Role } from "@prisma/client";

import { isAdminUnitManager, isCsAgentRole } from "@/lib/auth/unit-roles";

/** Client ID scan, finishing contract, and ملحق المد — CS on any unit; management/super admin. */
export function canAccessCsPortfolioDocuments(role: Role): boolean {
  return (
    isCsAgentRole(role) ||
    isAdminUnitManager(role) ||
    role === "SUPER_ADMIN"
  );
}

/** Replace or delete portfolio document files (not initial CS upload). */
export function canManageCsPortfolioDocumentFiles(role: Role): boolean {
  return isAdminUnitManager(role) || role === "SUPER_ADMIN";
}
