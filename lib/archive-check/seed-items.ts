import { applicableArchiveCheckItemKeys } from "@/lib/archive-check/items";
import { prisma as appPrisma } from "@/lib/prisma";
import type { OperationsProgressInput } from "@/lib/operations/operations-progress";

export type ArchiveCheckSeedDb = typeof appPrisma;

export async function seedArchiveCheckItemsForRequest(input: {
  prisma: ArchiveCheckSeedDb;
  unitRequestId: string;
  progressInput: OperationsProgressInput;
}): Promise<number> {
  const keys = applicableArchiveCheckItemKeys(input.progressInput);
  if (keys.length === 0) return 0;

  await input.prisma.archiveCheckItem.createMany({
    data: keys.map((itemKey) => ({
      unitRequestId: input.unitRequestId,
      itemKey,
    })),
    skipDuplicates: true,
  });

  return keys.length;
}
