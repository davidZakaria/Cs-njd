export type UnitDocumentKind =
  | "signedContract"
  | "extensionAnnex"
  | "finishingContract";

export const UNIT_DOCUMENT_API_SEGMENT: Record<UnitDocumentKind, string> = {
  signedContract: "signed-contract",
  extensionAnnex: "extension-annex",
  finishingContract: "finishing-contract",
};
