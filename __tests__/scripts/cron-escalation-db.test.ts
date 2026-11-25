import { describe, expect, it } from "vitest";

import { PrismaClient } from "@prisma/client";

import { runArchiveCheckGapEscalationJob } from "@/lib/archive-check/escalation";
import { runRequestEscalationJob } from "@/lib/requests/escalation";
import { runUnitCycleEscalationJob } from "@/lib/unit-cycle/escalation";

const liveDb =
  process.env.CRON_DB_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

describe("cron escalation jobs (live database)", () => {
  it.skipIf(!liveDb)(
    "executes all three escalation jobs without server-only import errors",
    async () => {
      const prisma = new PrismaClient();
      try {
        const request = await runRequestEscalationJob(prisma, { dryRun: true });
        expect(request.scanned).toBeGreaterThanOrEqual(0);
        expect(request.notified).toBe(0);

        const unitCycle = await runUnitCycleEscalationJob(prisma as never, {
          dryRun: true,
        });
        expect(unitCycle.scanned).toBeGreaterThanOrEqual(0);
        expect(unitCycle.notified).toBe(0);

        const archive = await runArchiveCheckGapEscalationJob(prisma as never, {
          dryRun: true,
        });
        expect(archive.scanned).toBeGreaterThanOrEqual(0);
        expect(archive.notified).toBe(0);
      } finally {
        await prisma.$disconnect();
      }
    }
  );
});