import type {
  EngineeringApprovalKind,
  UnitRequestApproverKind,
  UnitRequestType,
} from "@prisma/client";

import {
  getApprovalPathForType,
  getApproverKindAtStep,
  isFinalApprovalStep,
  normalizeApprovalPath,
} from "@/lib/requests/approval-paths";
import { resolveApproverKindToRole } from "@/lib/requests/approver-roles";
import { unitCycleStageForRequestType } from "@/lib/requests/stage-mapping";

export const DEFAULT_REQUEST_DUE_DAYS = 7;

export function computeDefaultDueDate(from: Date = new Date()): Date {
  const due = new Date(from);
  due.setDate(due.getDate() + DEFAULT_REQUEST_DUE_DAYS);
  return due;
}

export function buildSubmitState(type: UnitRequestType): {
  currentStepIndex: number;
  currentApproverKind: UnitRequestApproverKind | null;
  unitCycleStageKey: ReturnType<typeof unitCycleStageForRequestType>;
} {
  const path = normalizeApprovalPath(getApprovalPathForType(type));
  const kind = path[0] ?? null;
  return {
    currentStepIndex: 0,
    currentApproverKind: kind,
    unitCycleStageKey: unitCycleStageForRequestType(type),
  };
}

export function advanceAfterApproval(input: {
  type: UnitRequestType;
  currentStepIndex: number;
}): {
  done: boolean;
  nextStepIndex: number;
  nextApproverKind: UnitRequestApproverKind | null;
} {
  if (isFinalApprovalStep(input.type, input.currentStepIndex)) {
    return { done: true, nextStepIndex: input.currentStepIndex, nextApproverKind: null };
  }
  const nextIndex = input.currentStepIndex + 1;
  return {
    done: false,
    nextStepIndex: nextIndex,
    nextApproverKind: getApproverKindAtStep(input.type, nextIndex),
  };
}

export function engineeringKindForRequestType(
  type: UnitRequestType
): EngineeringApprovalKind | null {
  if (type === "SITE_VISIT") return "SITE_VISIT_COMPLETION";
  if (type === "SNAG_OR_DEFECT") return "SNAG_DEFECT_CLOSURE";
  return null;
}

export function resolvedRoleForStep(
  type: UnitRequestType,
  stepIndex: number
): import("@prisma/client").Role | null {
  const kind = getApproverKindAtStep(type, stepIndex);
  if (!kind) return null;
  return resolveApproverKindToRole(kind);
}

export function pathStepCount(type: UnitRequestType): number {
  return normalizeApprovalPath(getApprovalPathForType(type)).length;
}
