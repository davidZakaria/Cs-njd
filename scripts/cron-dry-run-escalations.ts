/**
 * One-off execution of all PM2 escalation crons (fake or production DB).
 * Usage: npx tsx scripts/cron-dry-run-escalations.ts
 */
import "dotenv/config";

import { runArchiveCheckGapEscalationJob } from "../lib/archive-check/escalation";
import { basePrisma, prisma } from "../lib/prisma";
import { runRequestEscalationJob } from "../lib/requests/escalation";
import { runUnitCycleEscalationJob } from "../lib/unit-cycle/escalation";

async function main() {
  const request = await runRequestEscalationJob(basePrisma);
  console.log(
    `[dry-run] request-escalation scanned=${request.scanned} notified=${request.notified}`
  );

  const unitCycle = await runUnitCycleEscalationJob(prisma as never);
  console.log(
    `[dry-run] unit-cycle scanned=${unitCycle.scanned} notified=${unitCycle.notified}`
  );

  const archive = await runArchiveCheckGapEscalationJob(basePrisma as never);
  console.log(
    `[dry-run] archive-gap scanned=${archive.scanned} notified=${archive.notified}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});