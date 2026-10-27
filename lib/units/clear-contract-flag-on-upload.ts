import type { prisma as DbClient } from "@/lib/prisma";

type Db = typeof DbClient;

import {
  clearFlagFromList,
  CONTRACT_UNIT_UPDATE_FLAG,
  type ContractUnitUpdateFlagKey,
} from "@/lib/units/contract-unit-update-flags";
import { resolveSwapLegalTaskIfComplete } from "@/lib/units/resolve-swap-legal-task";
import type { UnitDocumentKind } from "@/lib/uploads/unit-document-constants";

export async function clearContractFlagAfterUpload(
  db: Db,
  unitId: string,
  flag: ContractUnitUpdateFlagKey
): Promise<void> {
  const workflow = await db.contractWorkflow.findUnique({ where: { unitId } });
  if (!workflow) return;

  const next = clearFlagFromList(workflow.contractUnitUpdateFlags, flag);
  if (next.length === workflow.contractUnitUpdateFlags.length) return;

  await db.contractWorkflow.update({
    where: { unitId },
    data: { contractUnitUpdateFlags: next },
  });
  await resolveSwapLegalTaskIfComplete(db, unitId);
}

export async function clearFinishingContractFlagAfterUpload(
  db: Db,
  unitId: string
): Promise<void> {
  const finishing = await db.finishing.findUnique({ where: { unitId } });
  if (!finishing?.finishingContractNeedsUnitUpdate) return;

  await db.finishing.update({
    where: { unitId },
    data: { finishingContractNeedsUnitUpdate: false },
  });
  await resolveSwapLegalTaskIfComplete(db, unitId);
}

export function flagsClearedByUnitDocumentUpload(
  documentType: UnitDocumentKind
): ContractUnitUpdateFlagKey[] {
  switch (documentType) {
    case "signedContract":
      return [
        CONTRACT_UNIT_UPDATE_FLAG.preliminary,
        CONTRACT_UNIT_UPDATE_FLAG.finalSale,
      ];
    case "extensionAnnex":
      return [
        CONTRACT_UNIT_UPDATE_FLAG.gracePeriodAnnex,
        CONTRACT_UNIT_UPDATE_FLAG.saleAnnex,
      ];
    default:
      return [];
  }
}
