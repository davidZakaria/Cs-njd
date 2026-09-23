import "dotenv/config";

import { prisma } from "../lib/prisma";
import { runUpdateClientsFromExcel } from "../lib/import/update-clients";

async function main() {
  await runUpdateClientsFromExcel(process.argv);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
