import type { Role, UnitRequest, UnitRequestApproverKind, UnitRequestType } from "@prisma/client";

import type { CsAgentScope } from "@/lib/auth/cs-agent-scope";
import { canAccessUnitAsCsAgent } from "@/lib/auth/cs-agent-scope";
import {
  isAdminUnitManager,
  isCommunityManagementRole,
  isCsAgentRole,
  isOperationsRole,
} from "@/lib/auth/unit-roles";
import {
  getApproverKindAtStep,
  normalizeApprovalPath,
  getApprovalPathForType,
} from "@/lib/requests/approval-paths";
import {
  resolveApproverKindToRole,
  rolesThatCanActOnApproverKind,
} from "@/lib/requests/approver-roles";

export function canCreateUnitRequest(role: Role): boolean {
  return isCsAgentRole(role) || isAdminUnitManager(role) || role === "SUPER_ADMIN";
}

export function communityMayViewRequestType(type: UnitRequestType): boolean {
  return type === "HANDOVER_APPOINTMENT";
}

export function canViewUnitRequest(input: {
  role: Role;
  userId: string;
  request: Pick<
    UnitRequest,
    "requestedById" | "type" | "status" | "currentStepIndex" | "currentApproverKind"
  >;
  unitAgentId: string | null;
  csScope?: CsAgentScope | null;
}): boolean {
  const { role, userId, request, unitAgentId, csScope } = input;

  if (isAdminUnitManager(role) || role === "SUPER_ADMIN") return true;

  if (request.requestedById === userId) return true;

  if (isCommunityManagementRole(role)) {
    return communityMayViewRequestType(request.type);
  }

  if (isOperationsRole(role)) return false;

  if (request.status === "PENDING" && request.currentApproverKind) {
    if (userCanApproveAtCurrentStep({ role, userId, request, unitAgentId, csScope })) {
      return true;
    }
  }

  if (isCsAgentRole(role) && csScope && canAccessUnitAsCsAgent(csScope, unitAgentId)) {
    return true;
  }

  return false;
}

export function userCanApproveAtCurrentStep(input: {
  role: Role;
  userId: string;
  request: Pick<
    UnitRequest,
    "type" | "status" | "currentStepIndex" | "currentApproverKind"
  >;
  unitAgentId: string | null;
  csScope?: CsAgentScope | null;
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
  userId: string;
  request: Pick<
    UnitRequest,
    "type" | "status" | "currentStepIndex" | "currentApproverKind"
  >;
  unitAgentId: string | null;
  csScope?: CsAgentScope | null;
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
  status: UnitRequest["status"];
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
  status: UnitRequest["status"];
}): boolean {
  if (input.status === "APPROVED" || input.status === "REJECTED" || input.status === "CANCELLED") {
    return false;
  }
  return canEditDraftRequest({
    role: input.role,
    userId: input.userId,
    requestedById: input.requestedById,
  });
}

export function canAddRequestComment(input: {
  role: Role;
  userId: string;
  request: Pick<UnitRequest, "requestedById" | "type" | "status" | "currentStepIndex" | "currentApproverKind">;
  unitAgentId: string | null;
  csScope?: CsAgentScope | null;
}): boolean {
  return canViewUnitRequest({
    role: input.role,
    userId: input.userId,
    request: input.request,
    unitAgentId: input.unitAgentId,
    csScope: input.csScope,
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

export function requestMatchesRoleInbox(input: {
  role: Role;
  userId: string;
  type: UnitRequestType;
  status: UnitRequest["status"];
  currentApproverKind: UnitRequest["currentApproverKind"];
  requestedById: string;
  unitAgentId: string | null;
  csScope?: CsAgentScope | null;
  view: "awaiting" | "submitted";
}): boolean {
  if (input.view === "submitted") {
    return input.requestedById === input.userId;
  }

  if (input.status !== "PENDING" || !input.currentApproverKind) return false;

  return userCanApproveAtCurrentStep({
    role: input.role,
    userId: input.userId,
    request: {
      type: input.type,
      status: input.status,
      currentStepIndex: 0,
      currentApproverKind: input.currentApproverKind,
    },
    unitAgentId: input.unitAgentId,
    csScope: input.csScope,
  });
}

export function describeApprovalPath(type: UnitRequestType): UnitRequestApproverKind[] {
  return normalizeApprovalPath(getApprovalPathForType(type));
}

export function initialApproverKindForType(
  type: UnitRequestType
): import("@prisma/client").UnitRequestApproverKind | null {
  return getApproverKindAtStep(type, 0);
}
