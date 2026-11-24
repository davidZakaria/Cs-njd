/**
 * Strip sensitive keys from existing AuditLog oldData/newData JSON snapshots.
 *
 * Default: dry-run — prints how many rows would change (never prints values).
 * Use --apply to persist updates.
 *
 *   npx tsx scripts/redact-audit-secrets.ts
 *   npx tsx scripts/redact-audit-secrets.ts --apply
 */
import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import {
  auditJsonNeedsRedaction,
  redactAuditSnapshot,
} from "../lib/audit/redact-secrets";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const logs = await prisma.auditLog.findMany({
    select: { id: true, oldData: true, newData: true },
  });

  let affected = 0;

  for (const row of logs) {
    const oldNeeds = auditJsonNeedsRedaction(row.oldData);
    const newNeeds = auditJsonNeedsRedaction(row.newData);
    if (!oldNeeds && !newNeeds) continue;

    affected += 1;

    if (apply) {
      await prisma.auditLog.update({
        where: { id: row.id },
        data: {
          ...(oldNeeds
            ? { oldData: redactAuditSnapshot(row.oldData) as object }
            : {}),
          ...(newNeeds
            ? { newData: redactAuditSnapshot(row.newData) as object }
            : {}),
        },
      });
    }
  }

  if (apply) {
    console.log(`Updated ${affected} audit log row(s) with redacted snapshots.`);
  } else {
    console.log(
      `Dry run: ${affected} audit log row(s) would be updated. Re-run with --apply to persist.`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });