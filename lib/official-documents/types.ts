import type { OfficialDocumentType, UnitRequestType } from "@prisma/client";

export const OFFICIAL_DOCUMENT_TYPES: OfficialDocumentType[] = [
  "GRACE_PERIOD_ANNEX",
  "CONTRACT_AMENDMENT",
  "HANDOVER_RECORD",
  "FINISHING_CONTRACT_SUMMARY",
  "UNIT_SWAP_ADDENDUM",
];

export const DOCUMENT_TYPE_REQUIRES_APPROVED_REQUEST: Partial<
  Record<OfficialDocumentType, UnitRequestType>
> = {
  GRACE_PERIOD_ANNEX: "GRACE_PERIOD_ANNEX",
  CONTRACT_AMENDMENT: "CONTRACT_ISSUE_OR_AMENDMENT",
  UNIT_SWAP_ADDENDUM: "UNIT_SWAP",
};

export type MergeFieldValues = Record<string, string>;
