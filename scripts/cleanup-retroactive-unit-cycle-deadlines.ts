/**
 * Dry-run by default: reports active unit-cycle stages whose deadlines are
 * retroactive / impossible. Pass `--apply` to push deadlines forward (idempotent).
 */
import "dotenv/config";

import type { UnitCycleStageKey } from "@prisma/client";

import { prisma } from "../lib/prisma";
import {
  classifyRetroactiveUnitCycleDeadline,
  computeForwardStageDeadline,
  deadlineDaysForStage,
  type RetroactiveDeadlineReason,
} from "../lib/unit-cycle/deadlines";

const apply = process.argv.includes("--apply");

type PlannedUpdate = {
  stageId: string;
  unitCode: string;
  projectName: string;
  stageKey: UnitCycleStageKey;
  reason: RetroactiveDeadlineReason;
  from: Date;
  to: Date;
};

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

  const planned: PlannedUpdate[] = [];
  const byReason = new Map<RetroactiveDeadlineReason, number>();

  for (const row of rows) {
    const reason = classifyRetroactiveUnitCycleDeadline({
      status: row.status,
      startedAt: row.startedAt,
      deadlineAt: row.deadlineAt,
      unitCycleCreatedAt: row.unitCycle.createdAt,
      now,
    });
    if (!reason) continue;

    const project = row.unitCycle.unit.project;
    const days = deadlineDaysForStage(project, row.stageKey);
    const startedAt = row.startedAt ?? row.unitCycle.createdAt;
    const to = computeForwardStageDeadline(startedAt, days, now);

    planned.push({
      stageId: row.id,
      unitCode: row.unitCycle.unit.unitCode,
      projectName: project.name,
      stageKey: row.stageKey,
      reason,
      from: row.deadlineAt!,
      to,
    });
    byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  }

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

  const byStage = new Map<string, number>();
  for (const row of planned) {
    byStage.set(row.stageKey, (byStage.get(row.stageKey) ?? 0) + 1);
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