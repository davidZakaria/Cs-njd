import type { Prisma, UnitCycleStageKey } from "@prisma/client";

import { basePrisma } from "@/lib/prisma";

export async function recordUnitCycleAuditEvent(input: {
  unitCycleId: string;
  stageKey?: UnitCycleStageKey | null;
  userId?: string | null;
  action: string;
  details?: Prisma.InputJsonValue;
}): Promise<void> {
  await basePrisma.unitCycleAuditEvent.create({
    data: {
      unitCycleId: input.unitCycleId,
      stageKey: input.stageKey ?? null,
      userId: input.userId ?? null,
      action: input.action,
      details: input.details ?? undefined,
    },
  });
}
