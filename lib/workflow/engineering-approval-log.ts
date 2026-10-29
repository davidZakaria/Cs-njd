import type { EngineeringApprovalKind, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type EngineeringApprovalHistoryRow = {
  id: string;
  kind: EngineeringApprovalKind;
  summary: string | null;
  createdAt: Date;
  approvedBy: { id: string; name: string };
};

export async function recordUnitEngineeringApproval(input: {
  unitId: string;
  kind: EngineeringApprovalKind;
  approvedById: string;
  summary?: string | null;
  payload?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.unitEngineeringApproval.create({
    data: {
      unitId: input.unitId,
      kind: input.kind,
      approvedById: input.approvedById,
      summary: input.summary ?? null,
      payload: input.payload ?? undefined,
    },
  });
}

export async function listUnitEngineeringApprovalHistory(
  unitId: string,
  limit = 20
): Promise<EngineeringApprovalHistoryRow[]> {
  return prisma.unitEngineeringApproval.findMany({
    where: { unitId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      summary: true,
      createdAt: true,
      approvedBy: { select: { id: true, name: true } },
    },
  });
}
