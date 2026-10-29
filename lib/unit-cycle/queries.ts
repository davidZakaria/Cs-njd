import type { Role } from "@prisma/client";

import { prisma as appPrisma } from "@/lib/prisma";
import { activeUnitWhere } from "@/lib/prisma/soft-delete";
import {
  buildStageChecklist,
  resolveActiveStageKey,
} from "@/lib/operations/operations-progress";
import { buildUnitOperationsSnapshot } from "@/lib/unit-cycle/snapshot";
import {
  isStageOverdue,
  assertActiveStage,
} from "@/lib/unit-cycle/stage-rules";
import {
  managementRolesForCycle,
  roleCanOwnStage,
} from "@/lib/unit-cycle/owners";

export type UnitCycleDb = typeof appPrisma;

export type UnitCycleStageTaskRow = {
  unitCycleId: string;
  unitId: string;
  unitCode: string;
  projectId: string;
  projectName: string;
  stageKey: string;
  status: string;
  deadlineAt: string | null;
  overdue: boolean;
  checklistComplete: boolean;
  checklistPassed: number;
  checklistTotal: number;
};

export async function getMyStageTasks(input: {
  prisma: UnitCycleDb;
  userId: string;
  role: Role;
  agentIdForCs?: string | null;
  limit?: number;
}): Promise<UnitCycleStageTaskRow[]> {
  const limit = input.limit ?? 50;
  const ownerRoles: Role[] = [];

  if (managementRolesForCycle().includes(input.role)) {
    ownerRoles.push("MANAGEMENT");
  }
  if (input.role === "CS_AGENT") {
    ownerRoles.push("CS_AGENT");
  }

  if (ownerRoles.length === 0) {
    return [];
  }

  const cycles = await input.prisma.unitCycle.findMany({
    where: {
      unit: activeUnitWhere({
        project: { unitCycleEnabled: true },
        ...(input.role === "CS_AGENT"
          ? { agentId: input.agentIdForCs ?? input.userId }
          : {}),
      }),
      stages: {
        some: {
          ownerRole: { in: ownerRoles },
          status: { in: ["IN_PROGRESS", "BLOCKED"] },
        },
      },
    },
    include: {
      unit: {
        include: {
          project: true,
          contractWorkflow: true,
          finishing: true,
          engineeringApprovals: {
            where: { kind: "READINESS_SIGN_OFF" },
            select: { kind: true },
          },
        },
      },
      stages: { orderBy: { sortOrder: "asc" } },
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  const rows: UnitCycleStageTaskRow[] = [];

  for (const cycle of cycles) {
    const activeKey = resolveActiveStageKey(cycle.stages);
    if (!activeKey) continue;

    const activeStage = cycle.stages.find((stage) => stage.stageKey === activeKey);
    if (!activeStage) continue;
    if (!["IN_PROGRESS", "BLOCKED"].includes(activeStage.status)) continue;
    if (!roleCanOwnStage(input.role, activeStage.stageKey)) continue;

    const snapshot = buildUnitOperationsSnapshot({
      unit: cycle.unit,
      contractWorkflow: cycle.unit.contractWorkflow,
      finishing: cycle.unit.finishing,
      engineeringApprovals: cycle.unit.engineeringApprovals,
    });

    const checklist = buildStageChecklist(activeStage.stageKey, snapshot);
    const checklistComplete = checklist.every((item) => item.passed);

    rows.push({
      unitCycleId: cycle.id,
      unitId: cycle.unit.id,
      unitCode: cycle.unit.unitCode,
      projectId: cycle.unit.projectId,
      projectName: cycle.unit.project.name,
      stageKey: activeStage.stageKey,
      status: activeStage.status,
      deadlineAt: activeStage.deadlineAt?.toISOString() ?? null,
      overdue: isStageOverdue({
        status: activeStage.status,
        deadlineAt: activeStage.deadlineAt,
      }),
      checklistComplete,
      checklistPassed: checklist.filter((item) => item.passed).length,
      checklistTotal: checklist.length,
    });
  }

  return rows.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.deadlineAt && b.deadlineAt) {
      return a.deadlineAt.localeCompare(b.deadlineAt);
    }
    return a.unitCode.localeCompare(b.unitCode);
  });
}

export type OverdueStageRow = UnitCycleStageTaskRow & {
  daysOverdue: number;
};

export async function getOverdueStagesForManagement(
  prisma: UnitCycleDb,
  limit = 100
): Promise<OverdueStageRow[]> {
  const now = new Date();
  const cycles = await prisma.unitCycle.findMany({
    where: {
      unit: activeUnitWhere({ project: { unitCycleEnabled: true } }),
      stages: {
        some: {
          status: { in: ["IN_PROGRESS", "BLOCKED"] },
          deadlineAt: { lt: now },
        },
      },
    },
    include: {
      unit: {
        include: {
          project: true,
          contractWorkflow: true,
          finishing: true,
          engineeringApprovals: {
            where: { kind: "READINESS_SIGN_OFF" },
            select: { kind: true },
          },
        },
      },
      stages: { orderBy: { sortOrder: "asc" } },
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  const rows: OverdueStageRow[] = [];

  for (const cycle of cycles) {
    const activeKey = resolveActiveStageKey(cycle.stages);
    if (!activeKey) continue;
    const activeStage = cycle.stages.find((stage) => stage.stageKey === activeKey);
    if (!activeStage) continue;
    if (
      !assertActiveStage(cycle.stages, activeStage.stageKey) ||
      !isStageOverdue({
        status: activeStage.status,
        deadlineAt: activeStage.deadlineAt,
        now,
      })
    ) {
      continue;
    }

    const snapshot = buildUnitOperationsSnapshot({
      unit: cycle.unit,
      contractWorkflow: cycle.unit.contractWorkflow,
      finishing: cycle.unit.finishing,
      engineeringApprovals: cycle.unit.engineeringApprovals,
    });
    const checklist = buildStageChecklist(activeStage.stageKey, snapshot);
    const msPerDay = 86_400_000;
    const daysOverdue = activeStage.deadlineAt
      ? Math.max(
          1,
          Math.floor((now.getTime() - activeStage.deadlineAt.getTime()) / msPerDay)
        )
      : 0;

    rows.push({
      unitCycleId: cycle.id,
      unitId: cycle.unit.id,
      unitCode: cycle.unit.unitCode,
      projectId: cycle.unit.projectId,
      projectName: cycle.unit.project.name,
      stageKey: activeStage.stageKey,
      status: activeStage.status,
      deadlineAt: activeStage.deadlineAt?.toISOString() ?? null,
      overdue: true,
      checklistComplete: checklist.every((item) => item.passed),
      checklistPassed: checklist.filter((item) => item.passed).length,
      checklistTotal: checklist.length,
      daysOverdue,
    });
  }

  return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
}
