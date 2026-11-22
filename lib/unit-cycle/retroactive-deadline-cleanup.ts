import type { Project, UnitCycleStageKey, UnitCycleStageStatus } from "@prisma/client";

import {
  classifyRetroactiveUnitCycleDeadline,
  computeForwardStageDeadline,
  deadlineDaysForStage,
  type RetroactiveDeadlineReason,
} from "@/lib/unit-cycle/deadlines";

export type DeadlineCleanupStageRow = {
  id: string;
  status: UnitCycleStageStatus;
  stageKey: UnitCycleStageKey;
  startedAt: Date | null;
  deadlineAt: Date | null;
  unitCycleCreatedAt: Date;
  unitCode: string;
  projectName: string;
  projectDeadlineDays: Pick<
    Project,
    | "unitCycleContractDeadlineDays"
    | "unitCycleFinanceDeadlineDays"
    | "unitCycleEngineeringDeadlineDays"
    | "unitCycleLegalHandoverDeadlineDays"
  >;
};

export type PlannedDeadlineFix = {
  stageId: string;
  unitCode: string;
  projectName: string;
  stageKey: UnitCycleStageKey;
  reason: RetroactiveDeadlineReason;
  from: Date;
  to: Date;
};

export function cleanupApplyFromArgv(argv: string[] = process.argv): boolean {
  return argv.includes("--apply");
}

export function planRetroactiveUnitCycleDeadlineFixes(
  rows: DeadlineCleanupStageRow[],
  now: Date = new Date()
): PlannedDeadlineFix[] {
  const planned: PlannedDeadlineFix[] = [];

  for (const row of rows) {
    if (!row.deadlineAt) continue;

    const reason = classifyRetroactiveUnitCycleDeadline({
      status: row.status,
      startedAt: row.startedAt,
      deadlineAt: row.deadlineAt,
      unitCycleCreatedAt: row.unitCycleCreatedAt,
      now,
    });
    if (!reason) continue;

    const days = deadlineDaysForStage(row.projectDeadlineDays, row.stageKey);
    const startedAt = row.startedAt ?? row.unitCycleCreatedAt;
    const to = computeForwardStageDeadline(startedAt, days, now);

    planned.push({
      stageId: row.id,
      unitCode: row.unitCode,
      projectName: row.projectName,
      stageKey: row.stageKey,
      reason,
      from: row.deadlineAt,
      to,
    });
  }

  return planned;
}

export function summarizeDeadlineFixes(planned: PlannedDeadlineFix[]) {
  const byReason = new Map<RetroactiveDeadlineReason, number>();
  const byStage = new Map<string, number>();
  const byProject = new Map<string, number>();

  for (const row of planned) {
    byReason.set(row.reason, (byReason.get(row.reason) ?? 0) + 1);
    byStage.set(row.stageKey, (byStage.get(row.stageKey) ?? 0) + 1);
    byProject.set(row.projectName, (byProject.get(row.projectName) ?? 0) + 1);
  }

  return { byReason, byStage, byProject };
}

export function plannedFixIds(planned: PlannedDeadlineFix[]): string[] {
  return planned.map((row) => row.stageId);
}

/** After applying fixes, a second plan should be empty (idempotent). */
export function rowAfterDeadlineFix(
  row: DeadlineCleanupStageRow,
  fix: PlannedDeadlineFix
): DeadlineCleanupStageRow {
  if (row.id !== fix.stageId) return row;
  return { ...row, deadlineAt: fix.to };
}