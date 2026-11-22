/** Clear signed-protocol and fee signals globally for “not tracked” demo screenshots. */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.contractWorkflow.updateMany({
    data: {
      signedProtocolStoredName: null,
      signedProtocolDate: null,
      hasSignedProtocol: false,
    },
  });
  await prisma.finishing.updateMany({
    data: { doorFees: 0, aluminumFees: 0 },
  });
  console.log("Cleared protocol uploads and finishing fee signals.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());