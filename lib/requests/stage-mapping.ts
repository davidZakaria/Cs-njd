import type { UnitCycleStageKey, UnitRequestType } from "@prisma/client";

export const REQUEST_TYPE_UNIT_CYCLE_STAGE: Record<
  UnitRequestType,
  UnitCycleStageKey | null
> = {
  CONTRACT_ISSUE_OR_AMENDMENT: "CONTRACT",
  GRACE_PERIOD_ANNEX: "CONTRACT",
  UNIT_SWAP: "CONTRACT",
  FINISHING_PRICE_CHANGE_OR_DISCOUNT: "FINANCE",
  PAYMENT_PLAN_CHANGE: "FINANCE",
  REFUND: "FINANCE",
  SITE_VISIT: "ENGINEERING",
  SNAG_OR_DEFECT: "ENGINEERING",
  HANDOVER_APPOINTMENT: "LEGAL_HANDOVER",
  DOCUMENT_CORRECTION: "LEGAL_HANDOVER",
};

export function unitCycleStageForRequestType(
  type: UnitRequestType
): UnitCycleStageKey | null {
  return REQUEST_TYPE_UNIT_CYCLE_STAGE[type];
}
