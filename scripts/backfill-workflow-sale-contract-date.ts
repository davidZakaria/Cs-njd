/**
 * Backfill missing ContractWorkflow.contractDate from finalSaleContractDate.
 * Dry-run by default; pass --apply to write (idempotent).
 *
 * Usage:
 *   npx tsx scripts/backfill-workflow-sale-contract-date.ts
 *   npx tsx scripts/backfill-workflow-sale-contract-date.ts --apply
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const candidates = await prisma.contractWorkflow.findMany({
    where: {
      deletedAt: null,
      contractDate: null,
      finalSaleContractDate: { not: null },
    },
    select: { id: true, unitId: true, finalSaleContractDate: true },
  });

  console.log(
    apply ? "=== APPLY: workflow sale contract date backfill ===" : "=== DRY RUN ==="
  );
  console.log(`Candidates (contractDate null, finalSaleContractDate set): ${candidates.length}`);

  let updated = 0;
  for (const row of candidates) {
    if (!row.finalSaleContractDate) continue;
    console.log(
      `  workflow ${row.id} unit ${row.unitId} ← ${row.finalSaleContractDate.toISOString()}`
    );
    if (apply) {
      const result = await prisma.contractWorkflow.updateMany({
        where: { id: row.id, contractDate: null },
        data: { contractDate: row.finalSaleContractDate },
      });
      updated += result.count;
    }
  }

  if (apply) {
    console.log(`Updated: ${updated}`);
  } else if (candidates.length > 0) {
    console.log("Re-run with --apply to copy finalSaleContractDate → contractDate.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());