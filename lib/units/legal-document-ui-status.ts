import {
  CONTRACT_UNIT_UPDATE_FLAG,
  type ContractUnitUpdateFlagKey,
} from "@/lib/units/contract-unit-update-flags";

export type LegalDocumentUiStatus =
  | "missing"
  | "signed_no_file"
  | "file_uploaded"
  | "needs_update";

export function deriveLegalDocumentUiStatus(input: {
  paperSigned: boolean;
  hasFile: boolean;
  needsUpdate: boolean;
}): LegalDocumentUiStatus {
  if (input.needsUpdate) return "needs_update";
  if (input.hasFile) return "file_uploaded";
  if (input.paperSigned) return "signed_no_file";
  return "missing";
}

export function contractFlagsNeedUpdate(
  contractUnitUpdateFlags: string[],
  keys: ContractUnitUpdateFlagKey[]
): boolean {
  const set = new Set(contractUnitUpdateFlags);
  return keys.some((key) => set.has(key));
}

export const LEGAL_DOCUMENT_UPDATE_FLAGS = {
  preliminary: [CONTRACT_UNIT_UPDATE_FLAG.preliminary],
  extensionAnnex: [
    CONTRACT_UNIT_UPDATE_FLAG.saleAnnex,
    CONTRACT_UNIT_UPDATE_FLAG.gracePeriodAnnex,
  ],
  handoverRecord: [CONTRACT_UNIT_UPDATE_FLAG.handoverRecord],
  finalSale: [CONTRACT_UNIT_UPDATE_FLAG.finalSale],
} as const satisfies Record<
  string,
  readonly ContractUnitUpdateFlagKey[]
>;
