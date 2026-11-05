import type { Role, UnitCycleStageKey } from "@prisma/client";

import { managementRolesForCycle, resolveStageOwnerRole } from "@/lib/unit-cycle/owners";

export type WorkScopeMode = "personal" | "oversight";

export function departmentRolesWithClaimPool(): Role[] {
  return ["LEGAL", "FINANCE", "OPERATIONS"];
}

export function roleMatchesStageOwnerRole(userRole: Role, ownerRole: Role): boolean {
  if (managementRolesForCycle().includes(userRole)) {
    return ownerRole === "MANAGEMENT";
  }
  return userRole === ownerRole;
}

export function resolveUnitCycleAssigneeUserId(input: {
  stageKey: UnitCycleStageKey;
  assignedUserId: string | null;
  unitAgentId: string | null;
}): string | null {
  if (input.assignedUserId) return input.assignedUserId;
  if (input.stageKey === "ENGINEERING" && input.unitAgentId) {
    return input.unitAgentId;
  }
  return null;
}

export function unitCycleStageVisibleToUser(input: {
  mode: WorkScopeMode;
  userRole: Role;
  userId: string;
  stageKey: UnitCycleStageKey;
  stageOwnerRole: Role;
  assignedUserId: string | null;
  unitAgentId: string | null;
  active: boolean;
}): boolean {
  if (!input.active) return false;
  if (!roleCanWorkStage(input.userRole, input.stageKey, input.stageOwnerRole)) {
    return false;
  }

  const effectiveAssignee = resolveUnitCycleAssigneeUserId({
    stageKey: input.stageKey,
    assignedUserId: input.assignedUserId,
    unitAgentId: input.unitAgentId,
  });

  if (input.mode === "oversight") {
    return managementRolesForCycle().includes(input.userRole);
  }

  if (input.userRole === "CS_AGENT") {
    return (
      input.stageKey === "ENGINEERING" &&
      effectiveAssignee === input.userId
    );
  }

  if (effectiveAssignee) {
    return effectiveAssignee === input.userId;
  }

  if (departmentRolesWithClaimPool().includes(input.userRole)) {
    return roleMatchesStageOwnerRole(input.userRole, input.stageOwnerRole);
  }

  if (managementRolesForCycle().includes(input.userRole)) {
    return false;
  }

  return false;
}

export function roleCanWorkStage(
  userRole: Role,
  stageKey: UnitCycleStageKey,
  stageOwnerRole: Role
): boolean {
  if (userRole === "CS_AGENT") {
    return stageKey === "ENGINEERING" && stageOwnerRole === "CS_AGENT";
  }
  return roleMatchesStageOwnerRole(userRole, stageOwnerRole);
}

export function unitCycleStageClaimableByUser(input: {
  userRole: Role;
  userId: string;
  stageKey: UnitCycleStageKey;
  stageOwnerRole: Role;
  assignedUserId: string | null;
  unitAgentId: string | null;
}): boolean {
  if (input.assignedUserId) return false;
  if (
    input.userRole === "CS_AGENT" &&
    input.stageKey === "ENGINEERING" &&
    input.unitAgentId === input.userId
  ) {
    return false;
  }
  if (!roleCanWorkStage(input.userRole, input.stageKey, input.stageOwnerRole)) {
    return false;
  }
  if (departmentRolesWithClaimPool().includes(input.userRole)) {
    return roleMatchesStageOwnerRole(input.userRole, input.stageOwnerRole);
  }
  if (managementRolesForCycle().includes(input.userRole)) {
    return input.stageOwnerRole === "MANAGEMENT";
  }
  return false;
}

export function requestAwaitingVisibleToUser(input: {
  mode: WorkScopeMode;
  userRole: Role;
  userId: string;
  requestedById: string;
  assignedApproverUserId: string | null;
  escalatedToManagement: boolean;
  status: string;
  canApprove: boolean;
}): boolean {
  if (input.requestedById === input.userId) return true;
  if (input.status !== "PENDING" || !input.canApprove) return false;

  if (input.mode === "oversight" && managementRolesForCycle().includes(input.userRole)) {
    return true;
  }

  if (input.assignedApproverUserId) {
    return input.assignedApproverUserId === input.userId;
  }

  if (managementRolesForCycle().includes(input.userRole)) {
    return input.escalatedToManagement;
  }

  if (departmentRolesWithClaimPool().includes(input.userRole)) {
    return true;
  }

  return false;
}

export function requestClaimableByUser(input: {
  userRole: Role;
  assignedApproverUserId: string | null;
  canApprove: boolean;
}): boolean {
  if (!input.canApprove || input.assignedApproverUserId) return false;
  return (
    departmentRolesWithClaimPool().includes(input.userRole) ||
    managementRolesForCycle().includes(input.userRole)
  );
}

export function archiveGapTaskVisibleToUser(input: {
  mode: WorkScopeMode;
  userRole: Role;
  userId: string;
  ownerRole: Role;
  ownerUserId: string | null;
}): boolean {
  if (input.mode === "oversight" && managementRolesForCycle().includes(input.userRole)) {
    return true;
  }

  if (input.ownerUserId) {
    return input.ownerUserId === input.userId;
  }

  if (departmentRolesWithClaimPool().includes(input.userRole)) {
    return roleMatchesStageOwnerRole(input.userRole, input.ownerRole);
  }

  if (managementRolesForCycle().includes(input.userRole)) {
    return false;
  }

  return false;
}

export function archiveGapTaskClaimableByUser(input: {
  userRole: Role;
  ownerRole: Role;
  ownerUserId: string | null;
}): boolean {
  if (input.ownerUserId) return false;
  if (departmentRolesWithClaimPool().includes(input.userRole)) {
    return roleMatchesStageOwnerRole(input.userRole, input.ownerRole);
  }
  if (managementRolesForCycle().includes(input.userRole)) {
    return input.ownerRole === "MANAGEMENT";
  }
  return false;
}

export function resolveStageOwnerRoleForKey(stageKey: UnitCycleStageKey): Role {
  return resolveStageOwnerRole(stageKey);
}
