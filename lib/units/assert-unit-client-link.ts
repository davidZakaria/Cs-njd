import { prisma } from "@/lib/prisma";

export async function assertClientLinkedToUnit(
  unitId: string,
  clientId: string
): Promise<boolean> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { clientId: true },
  });
  if (!unit) return false;
  if (unit.clientId === clientId) return true;
  const link = await prisma.unitClient.findUnique({
    where: { unitId_clientId: { unitId, clientId } },
  });
  return link != null;
}
