import "server-only";

import type { Role, UnitRequest } from "@prisma/client";

import type { CsAgentScope } from "@/lib/auth/cs-agent-scope";
import { canAccessUnitAsCsAgent } from "@/lib/auth/cs-agent-scope";
import {
  isAdminUnitManager,
  isCommunityManagementRole,
  isCsAgentRole,
  isOperationsRole,
} from "@/lib/auth/unit-roles";
import {
  canCreateUnitRequest,
  communityMayViewRequestType,
  userCanApproveAtCurrentStep,
  userCanRejectAtCurrentStep,
  canEditDraftRequest,
  canCancelRequest,
  canUploadRequestAttachment,
  requestMatchesRoleInbox,
  listApproverKindsForRole,
  describeApprovalPath,
  initialApproverKindForType,
} from "@/lib/requests/permissions-core";

export {
  canCreateUnitRequest,
  communityMayViewRequestType,
  userCanApproveAtCurrentStep,
  userCanRejectAtCurrentStep,
  canEditDraftRequest,
  canCancelRequest,
  canUploadRequestAttachment,
  requestMatchesRoleInbox,
  listApproverKindsForRole,
  describeApprovalPath,
  initialApproverKindForType,
};

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
    if (
      userCanApproveAtCurrentStep({
        role,
        request,
      })
    ) {
      return true;
    }
  }

  if (isCsAgentRole(role) && csScope && canAccessUnitAsCsAgent(csScope, unitAgentId)) {
    return true;
  }

  return false;
}

export function canAddRequestComment(input: {
  role: Role;
  userId: string;
  request: Pick<
    UnitRequest,
    "requestedById" | "type" | "status" | "currentStepIndex" | "currentApproverKind"
  >;
  unitAgentId: string | null;
  csScope?: CsAgentScope | null;
}): boolean {
  return canViewUnitRequest(input);
}

export function userCanApproveAtCurrentStepWithScope(input: {
  role: Role;
  userId: string;
  request: Pick<
    UnitRequest,
    "type" | "status" | "currentStepIndex" | "currentApproverKind"
  >;
  unitAgentId: string | null;
  csScope?: CsAgentScope | null;
}): boolean {
  return userCanApproveAtCurrentStep({ role: input.role, request: input.request });
}

export function userCanRejectAtCurrentStepWithScope(input: {
  role: Role;
  userId: string;
  request: Pick<
    UnitRequest,
    "type" | "status" | "currentStepIndex" | "currentApproverKind"
  >;
  unitAgentId: string | null;
  csScope?: CsAgentScope | null;
}): boolean {
  return userCanRejectAtCurrentStep({ role: input.role, request: input.request });
}
