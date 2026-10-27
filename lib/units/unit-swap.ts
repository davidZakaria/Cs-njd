import type { ContractWorkflow, Finishing, Prisma } from "@prisma/client";

import type { prisma as DbClient } from "@/lib/prisma";

type Db = typeof DbClient;

import {
  computeContractUpdateFlagsFromWorkflow,
  UNIT_SWAP_LEGAL_TASK_MARKER,
} from "@/lib/units/contract-unit-update-flags";

function workflowTransferPayload(
  workflow: ContractWorkflow,
  contractUnitUpdateFlags: string[]
) {
  const {
    id: _id,
    unitId: _unitId,
    createdAt: _c,
    updatedAt: _u,
    deletedAt: _d,
    contractUnitUpdateFlags: _f,
    ...rest
  } = workflow;
  return { ...rest, contractUnitUpdateFlags };
}

function finishingTransferPayload(
  finishing: Finishing,
  finishingContractNeedsUnitUpdate: boolean
) {
  const {
    id: _id,
    unitId: _unitId,
    createdAt: _c,
    updatedAt: _u,
    deletedAt: _d,
    finishingContractNeedsUnitUpdate: _f,
    ...rest
  } = finishing;
  return { ...rest, finishingContractNeedsUnitUpdate };
}

async function loadUnitBundle(db: Db | Prisma.TransactionClient, unitId: string) {
  return db.unit.findUnique({
    where: { id: unitId },
    include: {
      project: { select: { name: true } },
      client: { select: { id: true, name: true } },
      unitClients: true,
      contractWorkflow: true,
      finishing: true,
      tickets: { where: { deletedAt: null } },
    },
  });
}

export type UnitSwapPreview = {
  sourceUnitId: string;
  sourceUnitCode: string;
  targetUnitId: string;
  targetUnitCode: string;
  projectName: string;
  primaryClientName: string;
  coOwnerCount: number;
  ticketCount: number;
  contractFlags: string[];
  finishingNeedsUpdate: boolean;
};

export async function buildUnitSwapPreview(
  db: Db,
  sourceUnitId: string,
  targetUnitId: string
): Promise<UnitSwapPreview | null> {
  const [source, target] = await Promise.all([
    loadUnitBundle(db, sourceUnitId),
    loadUnitBundle(db, targetUnitId),
  ]);
  if (!source || !target) return null;
  if (!source.clientId && source.unitClients.length === 0) return null;

  const { contractFlags, finishingNeedsUpdate } =
    computeContractUpdateFlagsFromWorkflow(
      source.contractWorkflow,
      source.finishing
    );

  return {
    sourceUnitId: source.id,
    sourceUnitCode: source.unitCode,
    targetUnitId: target.id,
    targetUnitCode: target.unitCode,
    projectName: source.project.name,
    primaryClientName: source.client?.name ?? "—",
    coOwnerCount: source.unitClients.filter(
      (l: { role: string }) => l.role === "CO_OWNER"
    ).length,
    ticketCount: source.tickets.length,
    contractFlags,
    finishingNeedsUpdate,
  };
}

export function assertTargetUnitEmpty(target: {
  clientId: string | null;
  unitClients: unknown[];
}): string | null {
  if (target.clientId) {
    return "Target unit already has a primary client assigned.";
  }
  if (target.unitClients.length > 0) {
    return "Target unit already has owners on record.";
  }
  return null;
}

export type UnitSwapHistoryRecord = {
  sourceUnitId: string;
  sourceUnitCode: string;
  sourceProjectName: string;
  targetUnitId: string;
  targetUnitCode: string;
  targetProjectName: string;
  clientName: string;
  actorUserId: string;
  actorName: string;
  swappedAt: Date;
};

export async function executeUnitSwapTransaction(
  db: Db,
  params: {
    sourceUnitId: string;
    targetUnitId: string;
    history: UnitSwapHistoryRecord;
    legalTaskNotes: string;
  }
): Promise<void> {
  await db.$transaction(async (tx) => {
    const dbTx = tx as Db;
    const source = await loadUnitBundle(dbTx, params.sourceUnitId);
    const target = await loadUnitBundle(dbTx, params.targetUnitId);
    if (!source || !target) {
      throw new Error("Unit not found");
    }
    if (!source.clientId && source.unitClients.length === 0) {
      throw new Error("Source unit has no client to move");
    }
    const targetError = assertTargetUnitEmpty(target);
    if (targetError) {
      throw new Error(targetError);
    }
    const { contractFlags, finishingNeedsUpdate } =
      computeContractUpdateFlagsFromWorkflow(
        source.contractWorkflow,
        source.finishing
      );

    await tx.ticket.updateMany({
      where: { unitId: source.id, deletedAt: null },
      data: { unitId: target.id },
    });

    await tx.unitClient.updateMany({
      where: { unitId: source.id },
      data: { unitId: target.id },
    });

    const unitFields = {
      gracePeriod: source.gracePeriod,
      deliveryYear: source.deliveryYear,
      contractPricePerMeter: source.contractPricePerMeter,
      agentId: source.agentId,
      category: source.category,
    };

    const { history } = params;

    await tx.unit.update({
      where: { id: target.id },
      data: {
        ...unitFields,
        clientId: source.clientId,
        swappedFromUnitId: history.sourceUnitId,
        swappedFromUnitCode: history.sourceUnitCode,
        swappedFromProjectName: history.sourceProjectName,
        swappedFromAt: history.swappedAt,
        swappedFromByUserId: history.actorUserId,
        swappedFromByName: history.actorName,
        swapOutgoingUnitId: null,
        swapOutgoingUnitCode: null,
        swapOutgoingProjectName: null,
        swapOutgoingAt: null,
        swapOutgoingByUserId: null,
        swapOutgoingByName: null,
        swapOutgoingClientName: null,
        swapHistoryNote: null,
      },
    });

    if (source.contractWorkflow) {
      const workflowData = workflowTransferPayload(
        source.contractWorkflow,
        contractFlags
      );
      await tx.contractWorkflow.upsert({
        where: { unitId: target.id },
        create: { unitId: target.id, ...workflowData },
        update: workflowData,
      });
      await tx.contractWorkflow.update({
        where: { unitId: source.id },
        data: {
          handoverStatus: "PENDING",
          actionLabel: null,
          contractDate: null,
          deliveryDate: null,
          hasSignedProtocol: false,
          hasSignedExtension: false,
          hasPreliminarySaleContract: false,
          signedProtocolDate: null,
          signedExtensionDate: null,
          hasFinalSaleContract: false,
          finalSaleContractDate: null,
          hasPaidFees: false,
          papersReceived: false,
          isLegallyBlocked: false,
          powerOfAttorneyReceived: false,
          inspectionDate: null,
          siteVisitDone: false,
          siteVisitDate1: null,
          siteVisitDate2: null,
          siteVisitDate3: null,
          clientInspectionNotes: null,
          dhlSentToClient: false,
          dhlSentToClientDate: null,
          dhlReceivedFromClient: false,
          dhlReceivedFromClientDate: null,
          paperHandoverPreliminaryCopy: false,
          paperHandoverOriginalProtocol: false,
          paperHandoverFinishingPapers: false,
          paperHandoverKeyReceived: false,
          signedProtocolStoredName: null,
          signedProtocolOriginalName: null,
          signedProtocolMimeType: null,
          signedProtocolSizeBytes: null,
          signedProtocolUploadedAt: null,
          signedProtocolUploadedById: null,
          signedContractFile: null,
          extensionAnnexFile: null,
          contractUnitUpdateFlags: [],
        },
      });
    }

    if (source.finishing) {
      const finishingData = finishingTransferPayload(
        source.finishing,
        finishingNeedsUpdate
      );
      await tx.finishing.upsert({
        where: { unitId: target.id },
        create: { unitId: target.id, ...finishingData },
        update: finishingData,
      });
      await tx.finishing.update({
        where: { unitId: source.id },
        data: {
          finishingType: "CUSTOM",
          packageType: null,
          executingCompany: null,
          packageLabel: null,
          companyName: null,
          contractDate: null,
          datedAt: null,
          emailDate: null,
          phase: "NOT_STARTED",
          phases: [],
          currentFinishingStatus: null,
          pricePerMeter: null,
          totalFinishingPrice: null,
          doorFees: null,
          aluminumFees: null,
          customModifications: null,
          modificationsCompleted: true,
          finishingContractFile: null,
          finishingContractNeedsUnitUpdate: false,
        },
      });
    }

    await tx.unit.update({
      where: { id: source.id },
      data: {
        clientId: null,
        gracePeriod: null,
        deliveryYear: null,
        contractPricePerMeter: null,
        agentId: null,
        category: null,
        swapOutgoingUnitId: history.targetUnitId,
        swapOutgoingUnitCode: history.targetUnitCode,
        swapOutgoingProjectName: history.targetProjectName,
        swapOutgoingAt: history.swappedAt,
        swapOutgoingByUserId: history.actorUserId,
        swapOutgoingByName: history.actorName,
        swapOutgoingClientName: history.clientName,
        swappedFromUnitId: null,
        swappedFromUnitCode: null,
        swappedFromProjectName: null,
        swappedFromAt: null,
        swappedFromByUserId: null,
        swappedFromByName: null,
        swapHistoryNote: null,
      },
    });

    if (contractFlags.length > 0 || finishingNeedsUpdate) {
      await tx.ticket.create({
        data: {
          unitId: target.id,
          createdById: history.actorUserId,
          notes: `${UNIT_SWAP_LEGAL_TASK_MARKER}\n${params.legalTaskNotes}`,
          status: "LEGAL",
          category: "LEGAL",
          pendingParty: "LEGAL",
        },
      });
    }
  });
}
