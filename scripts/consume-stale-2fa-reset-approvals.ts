/**
 * Marks unused APPROVED reset requests as consumed when the user already has 2FA enabled.
 * Dry-run by default — pass --apply to write usedAt timestamps.
 *
 * Usage:
 *   npx tsx scripts/consume-stale-2fa-reset-approvals.ts
 *   npx tsx scripts/consume-stale-2fa-reset-approvals.ts --apply
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";

async function main() {
  const apply = process.argv.includes("--apply");

  const stale = await prisma.twoFactorResetRequest.findMany({
    where: {
      status: "APPROVED",
      usedAt: null,
      user: {
        is2FAEnabled: true,
        twoFactorSecret: { not: null },
      },
    },
    select: {
      id: true,
      userId: true,
      reviewedAt: true,
      user: { select: { email: true } },
    },
  });

  console.log(
    `[consume-stale-2fa-reset-approvals] Found ${stale.length} stale unused approval(s).`
  );

  if (stale.length === 0) {
    return;
  }

  for (const row of stale) {
    console.log(
      `  - request ${row.id} user ${row.user.email} (reviewed ${row.reviewedAt?.toISOString() ?? "n/a"})`
    );
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to mark usedAt.");
    return;
  }

  const now = new Date();
  const result = await prisma.twoFactorResetRequest.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { usedAt: now },
  });

  console.log(`Updated ${result.count} request(s) with usedAt=${now.toISOString()}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });