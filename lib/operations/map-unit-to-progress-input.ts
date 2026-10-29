import type { OperationsProgressInput } from "@/lib/operations/operations-progress";

type UnitProgressSource = {
  gracePeriod: string | null;
  area: number | null;
  clientId: string | null;
  client: { nationalIdFile: string | null } | null;
  unitClients: Array<{
    role: string;
    position: number;
    client: { nationalIdFile: string | null };
  }>;
  contractWorkflow: {
    handoverStatus: string;
    hasPreliminarySaleContract: boolean;
    hasFinalSaleContract: boolean;
    hasSignedExtension: boolean;
    hasSignedProtocol: boolean;
    signedContractFile: string | null;
    extensionAnnexFile: string | null;
    signedProtocolStoredName: string | null;
    papersReceived: boolean;
    siteVisitDone: boolean;
    paperHandoverPreliminaryCopy: boolean;
    paperHandoverOriginalProtocol: boolean;
    paperHandoverFinishingPapers: boolean;
    paperHandoverKeyReceived: boolean;
    contractUnitUpdateFlags: string[];
  } | null;
  finishing: {
    packageType: string | null;
    finishingContractFile: string | null;
    finishingContractNeedsUnitUpdate: boolean;
    totalFinishingPrice: number | null;
    doorFees: number | null;
    aluminumFees: number | null;
    pricePerMeter: number | null;
  } | null;
};

function resolveOwners(unit: UnitProgressSource) {
  if (unit.unitClients.length > 0) {
    return [...unit.unitClients]
      .sort((a, b) => {
        if (a.role !== b.role) {
          return a.role === "PRIMARY" ? -1 : b.role === "PRIMARY" ? 1 : 0;
        }
        return a.position - b.position;
      })
      .map((link) => ({
        role: link.role as "PRIMARY" | "CO_OWNER",
        nationalIdFile: link.client.nationalIdFile,
      }));
  }
  if (unit.clientId && unit.client) {
    return [
      {
        role: "PRIMARY" as const,
        nationalIdFile: unit.client.nationalIdFile,
      },
    ];
  }
  return [];
}

export function mapUnitToOperationsProgressInput(
  unit: UnitProgressSource
): OperationsProgressInput {
  const owners = resolveOwners(unit);

  return {
    gracePeriod: unit.gracePeriod,
    unitArea: unit.area,
    owners,
    workflow: unit.contractWorkflow
      ? {
          handoverStatus: unit.contractWorkflow.handoverStatus,
          hasPreliminarySaleContract:
            unit.contractWorkflow.hasPreliminarySaleContract,
          hasFinalSaleContract: unit.contractWorkflow.hasFinalSaleContract,
          hasSignedExtension: unit.contractWorkflow.hasSignedExtension,
          hasSignedProtocol: unit.contractWorkflow.hasSignedProtocol,
          signedContractFile: unit.contractWorkflow.signedContractFile,
          extensionAnnexFile: unit.contractWorkflow.extensionAnnexFile,
          signedProtocolStoredName:
            unit.contractWorkflow.signedProtocolStoredName,
          papersReceived: unit.contractWorkflow.papersReceived,
          siteVisitDone: unit.contractWorkflow.siteVisitDone,
          paperHandoverPreliminaryCopy:
            unit.contractWorkflow.paperHandoverPreliminaryCopy,
          paperHandoverOriginalProtocol:
            unit.contractWorkflow.paperHandoverOriginalProtocol,
          paperHandoverFinishingPapers:
            unit.contractWorkflow.paperHandoverFinishingPapers,
          paperHandoverKeyReceived:
            unit.contractWorkflow.paperHandoverKeyReceived,
          contractUnitUpdateFlags:
            unit.contractWorkflow.contractUnitUpdateFlags,
        }
      : null,
    finishing: unit.finishing
      ? {
          packageType: unit.finishing.packageType,
          finishingContractFile: unit.finishing.finishingContractFile,
          finishingContractNeedsUnitUpdate:
            unit.finishing.finishingContractNeedsUnitUpdate,
          totalFinishingPrice: unit.finishing.totalFinishingPrice,
          doorFees: unit.finishing.doorFees,
          aluminumFees: unit.finishing.aluminumFees,
          pricePerMeter: unit.finishing.pricePerMeter,
        }
      : null,
  };
}
