import { auth } from "@/lib/auth";
import { serveUnitDocument } from "@/lib/api/serve-unit-document";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const session = await auth();
  const { unitId } = await params;

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { contractWorkflow: true },
  });

  if (!unit) {
    return serveUnitDocument(session, { id: unitId, agentId: null }, null, "signedContract", "signed-contract");
  }

  return serveUnitDocument(
    session,
    unit,
    unit.contractWorkflow?.signedContractFile,
    "signedContract",
    `signed-contract-${unitId}`
  );
}
