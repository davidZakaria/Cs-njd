import { CS_HANDOVER_CHECKLIST_FIELDS } from "@/lib/workflow/cs-handover-fields";

/** Site visit completion — engineering approval on any unit (CS / management). */
export const ENGINEERING_SITE_VISIT_FIELDS = new Set([
  "siteVisitDone",
  "siteVisitDate1",
  "siteVisitDate2",
  "siteVisitDate3",
]);

export function isEngineeringSiteVisitField(field: string): boolean {
  return ENGINEERING_SITE_VISIT_FIELDS.has(field);
}

/** CS agents may see but not edit (management / legal contract workflow). */
export const CS_VIEW_ONLY_HANDOVER_FIELDS = new Set([
  "handoverStatus",
  "actionLabel",
  "contractDate",
  "deliveryDate",
  "hasPreliminarySaleContract",
  "hasFinalSaleContract",
  "finalSaleContractDate",
  "hasPaidFees",
  "isLegallyBlocked",
]);

const MANAGEMENT_ONLY_FIELDS = new Set([
  "hasPaidFees",
  "isLegallyBlocked",
  "hasPreliminarySaleContract",
  "hasFinalSaleContract",
  "finalSaleContractDate",
  "handoverStatus",
  "actionLabel",
  "contractDate",
  "deliveryDate",
]);

export function canEditHandoverChecklistField(
  field: string,
  canEditManagement: boolean,
  canEditCsChecklist: boolean,
  canEngineeringApproveSiteVisit = false
): boolean {
  if (canEditManagement) return true;
  if (
    canEngineeringApproveSiteVisit &&
    ENGINEERING_SITE_VISIT_FIELDS.has(field)
  ) {
    return true;
  }
  if (!canEditCsChecklist) return false;
  if (MANAGEMENT_ONLY_FIELDS.has(field)) return false;
  return (CS_HANDOVER_CHECKLIST_FIELDS as readonly string[]).includes(field);
}

export function showManagementOnlyHint(
  field: string,
  canEditManagement: boolean,
  canEditCsChecklist: boolean
): boolean {
  return (
    !canEditManagement &&
    canEditCsChecklist &&
    CS_VIEW_ONLY_HANDOVER_FIELDS.has(field)
  );
}
