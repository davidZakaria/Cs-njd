/**
 * Preview (default) or apply all PM2 escalation crons against the configured DB.
 *
 * Default is dry-run: NO writes and NO inbox notifications.
 *
 *   npm run cron:dry-run-escalations
 *   npm run cron:dry-run-escalations -- --apply   # live (same as production cron)
 */
import "dotenv/config";

import { runArchiveCheckGapEscalationJob } from "../lib/archive-check/escalation";
import { basePrisma, prisma } from "../lib/prisma";
import { runRequestEscalationJob } from "../lib/requests/escalation";
import { runUnitCycleEscalationJob } from "../lib/unit-cycle/escalation";

const apply = process.argv.includes("--apply");

async function main() {
  const dryRun = !apply;
  if (dryRun) {
    console.log(
      "Escalation preview (dry run): no DB writes, no notifications. Pass --apply to execute for real.\n"
    );
  } else {
    console.warn(
      "LIVE MODE (--apply): writing escalations and sending inbox notifications.\n"
    );
  }

  const options = { dryRun };

  const request = await runRequestEscalationJob(basePrisma, options);
  logJob("request-escalation", request);

  const unitCycle = await runUnitCycleEscalationJob(prisma as never, options);
  logJob("unit-cycle-escalation", unitCycle);

  const archive = await runArchiveCheckGapEscalationJob(
    basePrisma as never,
    options
  );
  logJob("archive-gap-escalation", archive);
}

function logJob(
  label: string,
  result: { scanned: number; notified: number; preview?: unknown }
) {
  console.log(`--- ${label} ---`);
  console.log(`scanned=${result.scanned} notified=${result.notified}`);
  if (result.preview) {
    console.log(JSON.stringify(result.preview, null, 2));
  }
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});