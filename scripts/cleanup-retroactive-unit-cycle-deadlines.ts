/**
 * Dry-run by default: reports active unit-cycle stages whose deadlines are
 * retroactive / impossible. Pass `--apply` to push deadlines forward (idempotent).
 */
import "dotenv/config";

import { prisma } from "../lib/prisma";
import {
  cleanupApplyFromArgv,
  planRetroactiveUnitCycleDeadlineFixes,
  summarizeDeadlineFixes,
} from "../lib/unit-cycle/retroactive-deadline-cleanup";

const apply = cleanupApplyFromArgv();

async function main() {
  const now = new Date();
  const rows = await prisma.unitCycleStage.findMany({
    where: {
      status: { in: ["IN_PROGRESS", "BLOCKED"] },
      deadlineAt: { not: null },
    },
    include: {
      unitCycle: {
        include: {
          unit: { include: { project: true } },
        },
      },
    },
  });

  const planned = planRetroactiveUnitCycleDeadlineFixes(
    rows.map((row) => ({
      id: row.id,
      status: row.status,
      stageKey: row.stageKey,
      startedAt: row.startedAt,
      deadlineAt: row.deadlineAt,
      unitCycleCreatedAt: row.unitCycle.createdAt,
      unitCode: row.unitCycle.unit.unitCode,
      projectName: row.unitCycle.unit.project.name,
      projectDeadlineDays: row.unitCycle.unit.project,
    })),
    now
  );

  const { byReason, byStage, byProject } = summarizeDeadlineFixes(planned);

  console.log(
    apply
      ? `Applying ${planned.length} unit-cycle deadline fix(es)…`
      : `Dry run: ${planned.length} active stage(s) would get forward deadlines.`
  );

  if (byReason.size > 0) {
    console.log("\nBy reason:");
    for (const [reason, count] of [...byReason.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      console.log(`  ${reason}: ${count}`);
    }
  }

  if (byProject.size > 0) {
    console.log("\nBy project:");
    for (const [projectName, count] of [...byProject.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      console.log(`  ${projectName}: ${count}`);
    }
  }

  if (byStage.size > 0) {
    console.log("\nBy stage:");
    for (const [stageKey, count] of [...byStage.entries()].sort()) {
      console.log(`  ${stageKey}: ${count}`);
    }
  }

  for (const row of planned.slice(0, 25)) {
    console.log(
      `  ${row.projectName} · ${row.unitCode} (${row.stageKey}) [${row.reason}]: ${row.from.toISOString()} → ${row.to.toISOString()}`
    );
  }
  if (planned.length > 25) {
    console.log(`  … and ${planned.length - 25} more`);
  }

  if (!apply) {
    console.log("\nRe-run with --apply to persist changes.");
    return;
  }

  for (const row of planned) {
    await prisma.unitCycleStage.update({
      where: { id: row.stageId },
      data: { deadlineAt: row.to },
    });
  }

  console.log(`Updated ${planned.length} row(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });