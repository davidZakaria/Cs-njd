import type { Role, UnitRequestStatus, UnitRequestType } from "@prisma/client";

import { isOperationsRole } from "@/lib/auth/unit-roles";

export function isArchiveCheckRequest(type: UnitRequestType): boolean {
  return type === "ARCHIVE_CHECK";
}

export function isBulkArchiveCheckParent(input: {
  type: UnitRequestType;
  bulkProjectId: string | null;
  parentRequestId: string | null;
}): boolean {
  return (
    input.type === "ARCHIVE_CHECK" &&
    input.bulkProjectId != null &&
    input.parentRequestId == null
  );
}

export function isArchiveCheckChild(input: {
  type: UnitRequestType;
  parentRequestId: string | null;
}): boolean {
  return input.type === "ARCHIVE_CHECK" && input.parentRequestId != null;
}

export function operationsMayWorkArchiveCheck(input: {
  role: Role;
  type: UnitRequestType;
  status: UnitRequestStatus;
  currentApproverKind: string | null;
  archiveCheckSubmittedAt: Date | null;
}): boolean {
  if (!isOperationsRole(input.role)) return false;
  if (!isArchiveCheckRequest(input.type)) return false;
  if (input.status !== "PENDING") return false;
  if (input.currentApproverKind !== "OPERATIONS") return false;
  if (input.archiveCheckSubmittedAt) return false;
  return true;
}

export function operationsMayWorkArchiveCheckRequest(
  role: Role,
  request: {
    type: UnitRequestType;
    status: UnitRequestStatus;
    currentApproverKind: string | null;
    archiveCheckSubmittedAt: Date | null;
    parentRequestId: string | null;
    bulkProjectId: string | null;
  }
): boolean {
  if (isBulkArchiveCheckParent(request)) return false;
  return operationsMayWorkArchiveCheck({
    role,
    type: request.type,
    status: request.status,
    currentApproverKind: request.currentApproverKind,
    archiveCheckSubmittedAt: request.archiveCheckSubmittedAt,
  });
}

export function canDeleteOrReplaceArchiveCheckData(role: Role): boolean {
  if (role === "SUPER_ADMIN" || role === "MANAGEMENT") return true;
  return false;
}

export function csAgentMayChangePrimaryOwner(role: Role): boolean {
  return role !== "CS_AGENT";
}
