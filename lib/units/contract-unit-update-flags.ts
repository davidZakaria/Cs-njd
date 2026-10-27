/** Contract artifact keys flagged after a unit swap until a new file is uploaded. */
export const CONTRACT_UNIT_UPDATE_FLAG = {
  preliminary: "preliminary",
  saleAnnex: "saleAnnex",
  gracePeriodAnnex: "gracePeriodAnnex",
  handoverRecord: "handoverRecord",
  finalSale: "finalSale",
} as const;

export type ContractUnitUpdateFlagKey =
  (typeof CONTRACT_UNIT_UPDATE_FLAG)[keyof typeof CONTRACT_UNIT_UPDATE_FLAG];

export const ALL_CONTRACT_UNIT_UPDATE_FLAGS: ContractUnitUpdateFlagKey[] =
  Object.values(CONTRACT_UNIT_UPDATE_FLAG);

export const UNIT_SWAP_LEGAL_TASK_MARKER = "[UNIT_SWAP_CONTRACT_REVIEW]";

export function hasOpenContractUpdateFlags(input: {
  contractUnitUpdateFlags: string[];
  finishingContractNeedsUnitUpdate: boolean;
}): boolean {
  return (
    input.contractUnitUpdateFlags.length > 0 ||
    input.finishingContractNeedsUnitUpdate
  );
}

export function computeContractUpdateFlagsFromWorkflow(
  workflow: {
    hasPreliminarySaleContract: boolean;
    hasSignedExtension: boolean;
    extensionAnnexFile: string | null;
    hasSignedProtocol: boolean;
    signedProtocolStoredName: string | null;
    hasFinalSaleContract: boolean;
    signedContractFile: string | null;
  } | null,
  finishing: { finishingContractFile: string | null } | null
): {
  contractFlags: ContractUnitUpdateFlagKey[];
  finishingNeedsUpdate: boolean;
} {
  const contractFlags: ContractUnitUpdateFlagKey[] = [];
  if (!workflow && !finishing) {
    return { contractFlags, finishingNeedsUpdate: false };
  }

  if (workflow?.hasPreliminarySaleContract || workflow?.signedContractFile) {
    contractFlags.push(CONTRACT_UNIT_UPDATE_FLAG.preliminary);
  }
  if (workflow?.hasSignedExtension) {
    contractFlags.push(CONTRACT_UNIT_UPDATE_FLAG.saleAnnex);
  }
  if (workflow?.extensionAnnexFile) {
    contractFlags.push(CONTRACT_UNIT_UPDATE_FLAG.gracePeriodAnnex);
  }
  if (
    workflow?.hasSignedProtocol ||
    workflow?.signedProtocolStoredName
  ) {
    contractFlags.push(CONTRACT_UNIT_UPDATE_FLAG.handoverRecord);
  }
  if (workflow?.hasFinalSaleContract) {
    contractFlags.push(CONTRACT_UNIT_UPDATE_FLAG.finalSale);
  }

  const finishingNeedsUpdate = Boolean(finishing?.finishingContractFile);

  return { contractFlags, finishingNeedsUpdate };
}

export function clearFlagFromList(
  flags: string[],
  key: ContractUnitUpdateFlagKey
): string[] {
  return flags.filter((f) => f !== key);
}
