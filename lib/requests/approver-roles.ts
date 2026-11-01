import type { Role, UnitRequestApproverKind } from "@prisma/client";

export type OrgStaffAvailability = {
  hasLegalStaff: boolean;
  hasFinanceStaff: boolean;
};

export const DEFAULT_ORG_STAFF: OrgStaffAvailability = {
  hasLegalStaff: true,
  hasFinanceStaff: true,
};

/**
 * Maps logical approver steps to staff roles.
 * When no active LEGAL/FINANCE user exists, steps fall back to MANAGEMENT.
 */
export function resolveApproverKindToRole(
  kind: UnitRequestApproverKind,
  staff: OrgStaffAvailability = DEFAULT_ORG_STAFF
): Role {
  if (kind === "LEGAL") {
    return staff.hasLegalStaff ? "LEGAL" : "MANAGEMENT";
  }
  if (kind === "FINANCE") {
    return staff.hasFinanceStaff ? "FINANCE" : "MANAGEMENT";
  }
  if (kind === "CS_AGENT") return "CS_AGENT";
  return "MANAGEMENT";
}

export function rolesThatCanActOnApproverKind(
  kind: UnitRequestApproverKind,
  staff: OrgStaffAvailability = DEFAULT_ORG_STAFF
): Role[] {
  const primary = resolveApproverKindToRole(kind, staff);
  if (primary === "MANAGEMENT") {
    return ["MANAGEMENT", "SUPER_ADMIN"];
  }
  if (primary === "CS_AGENT") {
    return ["CS_AGENT", "SUPER_ADMIN", "MANAGEMENT"];
  }
  if (primary === "LEGAL") {
    return staff.hasLegalStaff
      ? ["LEGAL", "SUPER_ADMIN"]
      : ["MANAGEMENT", "SUPER_ADMIN"];
  }
  if (primary === "FINANCE") {
    return staff.hasFinanceStaff
      ? ["FINANCE", "SUPER_ADMIN"]
      : ["MANAGEMENT", "SUPER_ADMIN"];
  }
  return [primary, "SUPER_ADMIN"];
}

export function managementMayActOnDedicatedStep(
  kind: UnitRequestApproverKind,
  staff: OrgStaffAvailability
): boolean {
  if (kind === "LEGAL") return !staff.hasLegalStaff;
  if (kind === "FINANCE") return !staff.hasFinanceStaff;
  return kind === "MANAGEMENT" || kind === "CS_AGENT";
}

export function isOperationsAnApprover(): boolean {
  return false;
}
