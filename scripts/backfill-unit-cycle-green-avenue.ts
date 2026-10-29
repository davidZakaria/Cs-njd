import "dotenv/config";

import { prisma } from "../lib/prisma";
import { initializeGreenAvenueUnitCycles } from "../lib/unit-cycle/ensure-cycle";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const result = await initializeGreenAvenueUnitCycles(prisma, { dryRun });

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "apply",
        ...result,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
