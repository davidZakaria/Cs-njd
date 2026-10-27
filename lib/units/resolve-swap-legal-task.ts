import type { prisma as DbClient } from "@/lib/prisma";

type Db = typeof DbClient;

import {
  hasOpenContractUpdateFlags,
  UNIT_SWAP_LEGAL_TASK_MARKER,
} from "@/lib/units/contract-unit-update-flags";

/** Auto-resolve the unit-swap legal review ticket when all contract flags are cleared. */
export async function resolveSwapLegalTaskIfComplete(
  db: Db,
  unitId: string
): Promise<void> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: { contractWorkflow: true, finishing: true },
  });
  if (!unit) return;

  const flagsOpen = hasOpenContractUpdateFlags({
    contractUnitUpdateFlags: unit.contractWorkflow?.contractUnitUpdateFlags ?? [],
    finishingContractNeedsUnitUpdate:
      unit.finishing?.finishingContractNeedsUnitUpdate ?? false,
  });
  if (flagsOpen) return;

  const openTask = await db.ticket.findFirst({
    where: {
      unitId,
      deletedAt: null,
      status: { not: "RESOLVED" },
      notes: { startsWith: UNIT_SWAP_LEGAL_TASK_MARKER },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!openTask) return;

  await db.ticket.update({
    where: { id: openTask.id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      pendingParty: "NONE",
    },
  });
}
