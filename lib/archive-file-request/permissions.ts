import type { Role } from "@prisma/client";

import { isOperationsRole } from "@/lib/auth/unit-roles";

export function canAccessOperationsArchiveFileInbox(role: Role): boolean {
  return isOperationsRole(role) || role === "SUPER_ADMIN";
}

export function operationsMayFulfillArchiveFileRequest(input: {
  role: Role;
  status: import("@prisma/client").UnitRequestStatus;
  type: import("@prisma/client").UnitRequestType;
  currentApproverKind: import("@prisma/client").UnitRequestApproverKind | null;
}): boolean {
  if (!canAccessOperationsArchiveFileInbox(input.role)) return false;
  if (input.type !== "ARCHIVE_FILE_REQUEST") return false;
  if (input.status !== "PENDING") return false;
  return input.currentApproverKind === "OPERATIONS";
}
