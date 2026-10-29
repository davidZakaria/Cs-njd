import type {
  Role,
  UnitRequest,
  UnitRequestApproverKind,
  UnitRequestStatus,
  UnitRequestType,
} from "@prisma/client";

import {
  isAdminUnitManager,
  isCommunityManagementRole,
  isCsAgentRole,
} from "@/lib/auth/unit-roles";
import type { RequestsPageFilters, UnitRequestListRow } from "@/lib/requests/types";
import {
  getApproverKindAtStep,
  getApprovalPathForType,
  normalizeApprovalPath,
} from "@/lib/requests/approval-paths";
import {
  resolveApproverKindToRole,
  rolesThatCanActOnApproverKind,
} from "@/lib/requests/approver-roles";

/** Pure permission helpers safe for client bundles (no Prisma / cs-agent-scope). */

export function canCreateUnitRequest(role: Role): boolean {
  return isCsAgentRole(role) || isAdminUnitManager(role) || role === "SUPER_ADMIN";
}

export function communityMayViewRequestType(type: UnitRequestType): boolean {
  return type === "HANDOVER_APPOINTMENT";
}

export function userCanApproveAtCurrentStep(input: {
  role: Role;
  request: Pick<
    UnitRequest,
    "type" | "status" | "currentStepIndex" | "currentApproverKind"
  >;
}): boolean {
  const { role, request } = input;
  if (request.status !== "PENDING" || !request.currentApproverKind) {
    return false;
  }

  const allowedRoles = rolesThatCanActOnApproverKind(request.currentApproverKind);
  if (!allowedRoles.includes(role)) return false;

  const resolved = resolveApproverKindToRole(request.currentApproverKind);
  if (resolved === "CS_AGENT" && isCsAgentRole(role)) {
    return true;
  }

  return true;
}

export function userCanRejectAtCurrentStep(input: {
  role: Role;
  request: Pick<
    UnitRequest,
    "type" | "status" | "currentStepIndex" | "currentApproverKind"
  >;
}): boolean {
  return userCanApproveAtCurrentStep(input);
}

export function canEditDraftRequest(input: {
  role: Role;
  userId: string;
  requestedById: string;
}): boolean {
  if (!canCreateUnitRequest(input.role)) return false;
  return (
    input.requestedById === input.userId ||
    isAdminUnitManager(input.role) ||
    input.role === "SUPER_ADMIN"
  );
}

export function canCancelRequest(input: {
  role: Role;
  userId: string;
  requestedById: string;
  status: UnitRequestStatus;
}): boolean {
  if (input.status !== "DRAFT" && input.status !== "PENDING") return false;
  return (
    input.requestedById === input.userId ||
    isAdminUnitManager(input.role) ||
    input.role === "SUPER_ADMIN"
  );
}

export function canUploadRequestAttachment(input: {
  role: Role;
  userId: string;
  requestedById: string;
  status: UnitRequestStatus;
}): boolean {
  if (
    input.status === "APPROVED" ||
    input.status === "REJECTED" ||
    input.status === "CANCELLED"
  ) {
    return false;
  }
  return canEditDraftRequest({
    role: input.role,
    userId: input.userId,
    requestedById: input.requestedById,
  });
}

export function requestMatchesRoleInbox(input: {
  role: Role;
  userId: string;
  type: UnitRequestType;
  status: UnitRequestStatus;
  currentApproverKind: UnitRequestApproverKind | null;
  requestedById: string;
  view: "awaiting" | "submitted";
}): boolean {
  if (input.view === "submitted") {
    return input.requestedById === input.userId;
  }

  if (input.status !== "PENDING" || !input.currentApproverKind) return false;

  return userCanApproveAtCurrentStep({
    role: input.role,
    request: {
      type: input.type,
      status: input.status,
      currentStepIndex: 0,
      currentApproverKind: input.currentApproverKind,
    },
  });
}

export function listApproverKindsForRole(role: Role): UnitRequestApproverKind[] {
  const kinds: UnitRequestApproverKind[] = [
    "LEGAL",
    "FINANCE",
    "MANAGEMENT",
    "CS_AGENT",
  ];
  return kinds.filter((kind) => rolesThatCanActOnApproverKind(kind).includes(role));
}

export function describeApprovalPath(type: UnitRequestType): UnitRequestApproverKind[] {
  return normalizeApprovalPath(getApprovalPathForType(type));
}

export function initialApproverKindForType(
  type: UnitRequestType
): UnitRequestApproverKind | null {
  return getApproverKindAtStep(type, 0);
}

export function filterRequestRowsByView(input: {
  rows: UnitRequestListRow[];
  role: Role;
  userId: string;
  filters: RequestsPageFilters;
  now?: Date;
}): UnitRequestListRow[] {
  const now = input.now ?? new Date();
  let list = input.rows;

  if (isCommunityManagementRole(input.role)) {
    list = list.filter((row) => row.type === "HANDOVER_APPOINTMENT");
  }

  if (input.filters.view === "awaiting") {
    list = list.filter((row) =>
      requestMatchesRoleInbox({
        role: input.role,
        userId: input.userId,
        type: row.type,
        status: row.status,
        currentApproverKind: row.currentApproverKind,
        requestedById: row.requestedById,
        view: "awaiting",
      })
    );
  } else if (input.filters.view === "submitted") {
    list = list.filter((row) => row.requestedById === input.userId);
  } else if (!isAdminUnitManager(input.role) && input.role !== "SUPER_ADMIN") {
    list = list.filter(
      (row) =>
        row.requestedById === input.userId ||
        requestMatchesRoleInbox({
          role: input.role,
          userId: input.userId,
          type: row.type,
          status: row.status,
          currentApproverKind: row.currentApproverKind,
          requestedById: row.requestedById,
          view: "awaiting",
        }) ||
        (isCommunityManagementRole(input.role) && row.type === "HANDOVER_APPOINTMENT")
    );
  }

  if (input.filters.status !== "all") {
    list = list.filter((row) => row.status === input.filters.status);
  }
  if (input.filters.type !== "all") {
    list = list.filter((row) => row.type === input.filters.type);
  }
  if (input.filters.project !== "all") {
    list = list.filter((row) => row.projectName === input.filters.project);
  }
  if (input.filters.overdue === "yes") {
    list = list.filter(
      (row) =>
        row.status === "PENDING" &&
        row.dueDate != null &&
        row.dueDate.getTime() < now.getTime()
    );
  }

  return list;
}
