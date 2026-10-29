import type { UnitRequestApproverKind, UnitRequestType } from "@prisma/client";

/** Ordered approval steps per request type (config-only; roles resolved separately). */
export const APPROVAL_PATH_BY_TYPE: Record<
  UnitRequestType,
  UnitRequestApproverKind[]
> = {
  CONTRACT_ISSUE_OR_AMENDMENT: ["LEGAL", "MANAGEMENT"],
  GRACE_PERIOD_ANNEX: ["LEGAL", "MANAGEMENT"],
  UNIT_SWAP: ["MANAGEMENT"],
  FINISHING_PRICE_CHANGE_OR_DISCOUNT: ["FINANCE", "MANAGEMENT"],
  PAYMENT_PLAN_CHANGE: ["FINANCE"],
  REFUND: ["FINANCE", "MANAGEMENT"],
  SITE_VISIT: ["CS_AGENT"],
  SNAG_OR_DEFECT: ["CS_AGENT"],
  HANDOVER_APPOINTMENT: ["CS_AGENT"],
  DOCUMENT_CORRECTION: ["LEGAL"],
};

export function getApprovalPathForType(
  type: UnitRequestType
): UnitRequestApproverKind[] {
  return [...APPROVAL_PATH_BY_TYPE[type]];
}

export function normalizeApprovalPath(
  steps: UnitRequestApproverKind[]
): UnitRequestApproverKind[] {
  const out: UnitRequestApproverKind[] = [];
  for (const step of steps) {
    if (out[out.length - 1] !== step) {
      out.push(step);
    }
  }
  return out;
}

export function getApproverKindAtStep(
  type: UnitRequestType,
  stepIndex: number
): UnitRequestApproverKind | null {
  const path = normalizeApprovalPath(getApprovalPathForType(type));
  return path[stepIndex] ?? null;
}

export function isFinalApprovalStep(
  type: UnitRequestType,
  stepIndex: number
): boolean {
  const path = normalizeApprovalPath(getApprovalPathForType(type));
  return stepIndex >= path.length - 1;
}
