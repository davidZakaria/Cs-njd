import type { Role, UnitRequestApproverKind } from "@prisma/client";

/**
 * Maps logical approver steps to staff roles.
 * When dedicated LEGAL / FINANCE roles are added to the Role enum, set the flags below.
 */
export const ORG_HAS_LEGAL_STAFF_ROLE = false;
export const ORG_HAS_FINANCE_STAFF_ROLE = false;

export function resolveApproverKindToRole(
  kind: UnitRequestApproverKind
): Role {
  if (kind === "LEGAL") {
    return ORG_HAS_LEGAL_STAFF_ROLE ? ("LEGAL" as Role) : "MANAGEMENT";
  }
  if (kind === "FINANCE") {
    return ORG_HAS_FINANCE_STAFF_ROLE ? ("FINANCE" as Role) : "MANAGEMENT";
  }
  if (kind === "CS_AGENT") return "CS_AGENT";
  return "MANAGEMENT";
}

export function rolesThatCanActOnApproverKind(
  kind: UnitRequestApproverKind
): Role[] {
  const primary = resolveApproverKindToRole(kind);
  if (primary === "MANAGEMENT") {
    return ["MANAGEMENT", "SUPER_ADMIN"];
  }
  if (primary === "CS_AGENT") {
    return ["CS_AGENT", "SUPER_ADMIN", "MANAGEMENT"];
  }
  return [primary, "SUPER_ADMIN"];
}

export function isOperationsAnApprover(): boolean {
  return false;
}
