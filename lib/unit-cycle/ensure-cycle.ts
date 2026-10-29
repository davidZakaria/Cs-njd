import type { UnitCycleStageKey, UnitCycleStageStatus } from "@prisma/client";

import { prisma as appPrisma } from "@/lib/prisma";
import {
  deriveCompletedStageKeys,
  UNIT_CYCLE_STAGE_ORDER,
} from "@/lib/operations/operations-progress";
import { buildUnitOperationsSnapshot } from "@/lib/unit-cycle/snapshot";
import { resolveStageOwnerRole } from "@/lib/unit-cycle/owners";
import {
  computeStageDeadline,
  deadlineDaysForStage,
} from "@/lib/unit-cycle/deadlines";
import { recordUnitCycleAuditEvent } from "@/lib/unit-cycle/audit";

export type UnitCycleDb = typeof appPrisma;

type EnsureUnitCycleInput = {
  unitId: string;
  project: {
    unitCycleEnabled: boolean;
    unitCycleContractDeadlineDays: number;
    unitCycleFinanceDeadlineDays: number;
    unitCycleEngineeringDeadlineDays: number;
    unitCycleLegalHandoverDeadlineDays: number;
  };
  dryRun?: boolean;
};

export type EnsureUnitCycleResult =
  | { status: "disabled" }
  | { status: "dry_run"; wouldCreate: boolean; completedStages: UnitCycleStageKey[] }
  | { status: "ready"; unitCycleId: string };

export async function ensureUnitCycleForUnit(
  prisma: UnitCycleDb,
  input: EnsureUnitCycleInput
): Promise<EnsureUnitCycleResult> {
  if (!input.project.unitCycleEnabled) {
    return { status: "disabled" };
  }

  const unit = await prisma.unit.findUnique({
    where: { id: input.unitId },
    include: {
      contractWorkflow: true,
      finishing: true,
      engineeringApprovals: {
        where: { kind: "READINESS_SIGN_OFF" },
        select: { kind: true },
        take: 1,
      },
      unitCycle: { include: { stages: true } },
    },
  });

  if (!unit) {
    throw new Error(`Unit not found: ${input.unitId}`);
  }

  const snapshot = buildUnitOperationsSnapshot({
    unit,
    contractWorkflow: unit.contractWorkflow,
    finishing: unit.finishing,
    engineeringApprovals: unit.engineeringApprovals,
  });

  const completedKeys = deriveCompletedStageKeys(snapshot);

  if (input.dryRun) {
    return {
      status: "dry_run",
      wouldCreate: !unit.unitCycle,
      completedStages: completedKeys,
    };
  }

  if (unit.unitCycle) {
    return { status: "ready", unitCycleId: unit.unitCycle.id };
  }

  const now = new Date();
  const stageRows = buildInitialStageRows({
    project: input.project,
    completedKeys,
    now,
  });

  const created = await prisma.unitCycle.create({
    data: {
      unitId: unit.id,
      stages: { create: stageRows },
    },
  });

  await recordUnitCycleAuditEvent({
    unitCycleId: created.id,
    action: "cycle_initialized",
    details: { completedStages: completedKeys },
  });

  return { status: "ready", unitCycleId: created.id };
}

function buildInitialStageRows(input: {
  project: EnsureUnitCycleInput["project"];
  completedKeys: UnitCycleStageKey[];
  now: Date;
}) {
  let activeAssigned = false;

  return UNIT_CYCLE_STAGE_ORDER.map((stageKey, index) => {
    const ownerRole = resolveStageOwnerRole(stageKey);
    let status: UnitCycleStageStatus = "NOT_STARTED";
    let startedAt: Date | null = null;
    let completedAt: Date | null = null;
    let deadlineAt: Date | null = null;

    if (input.completedKeys.includes(stageKey)) {
      status = "DONE";
      completedAt = input.now;
      startedAt = input.now;
    } else if (!activeAssigned) {
      status = "IN_PROGRESS";
      startedAt = input.now;
      deadlineAt = computeStageDeadline(
        input.now,
        deadlineDaysForStage(input.project, stageKey)
      );
      activeAssigned = true;
    }

    return {
      stageKey,
      status,
      ownerRole,
      sortOrder: index,
      startedAt,
      completedAt,
      deadlineAt,
    };
  });
}

export async function initializeGreenAvenueUnitCycles(
  prisma: UnitCycleDb,
  options: { dryRun: boolean }
): Promise<{
  projectName: string;
  processed: number;
  wouldCreate: number;
  skippedExisting: number;
}> {
  const project = await prisma.project.findUnique({
    where: { name: "GREEN AVENUE" },
    select: {
      id: true,
      name: true,
      unitCycleEnabled: true,
      unitCycleContractDeadlineDays: true,
      unitCycleFinanceDeadlineDays: true,
      unitCycleEngineeringDeadlineDays: true,
      unitCycleLegalHandoverDeadlineDays: true,
    },
  });

  if (!project) {
    throw new Error("GREEN AVENUE project not found");
  }

  if (!project.unitCycleEnabled && !options.dryRun) {
    await prisma.project.update({
      where: { id: project.id },
      data: { unitCycleEnabled: true },
    });
    project.unitCycleEnabled = true;
  }

  const units = await prisma.unit.findMany({
    where: { projectId: project.id, deletedAt: null },
    select: { id: true, unitCycle: { select: { id: true } } },
  });

  let processed = 0;
  let wouldCreate = 0;
  let skippedExisting = 0;

  for (const unit of units) {
    if (unit.unitCycle) {
      skippedExisting += 1;
      continue;
    }

    const result = await ensureUnitCycleForUnit(prisma, {
      unitId: unit.id,
      project,
      dryRun: options.dryRun,
    });

    processed += 1;
    if (result.status === "dry_run" && result.wouldCreate) {
      wouldCreate += 1;
    }
  }

  return {
    projectName: project.name,
    processed,
    wouldCreate,
    skippedExisting,
  };
}
