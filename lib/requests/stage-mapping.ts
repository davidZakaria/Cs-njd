import type { UnitCycleStageKey, UnitRequestType } from "@prisma/client";

/** Maps request types to the unit cycle stage they block when open (pilot projects only). */
export const REQUEST_TYPE_UNIT_CYCLE_STAGE: Record<
  UnitRequestType,
  UnitCycleStageKey | null
> = {
  CONTRACT_ISSUE_OR_AMENDMENT: "LEGAL_HANDOVER",
  GRACE_PERIOD_ANNEX: "LEGAL_HANDOVER",
  UNIT_SWAP: null,
  FINISHING_PRICE_CHANGE_OR_DISCOUNT: "FINANCE",
  PAYMENT_PLAN_CHANGE: "FINANCE",
  REFUND: "FINANCE",
  SITE_VISIT: "ENGINEERING",
  SNAG_OR_DEFECT: "ENGINEERING",
  HANDOVER_APPOINTMENT: "LEGAL_HANDOVER",
  DOCUMENT_CORRECTION: "LEGAL_HANDOVER",
  ARCHIVE_CHECK: "LEGAL_HANDOVER",
  ARCHIVE_FILE_REQUEST: null,
};

export function unitCycleStageForRequestType(
  type: UnitRequestType
): UnitCycleStageKey | null {
  return REQUEST_TYPE_UNIT_CYCLE_STAGE[type];
}
