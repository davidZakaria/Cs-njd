import type { Prisma, Role } from "@prisma/client";

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
  resolveStageOwnerRole,
} from "@/lib/unit-cycle/owners";
import type { OverdueTasksPageFilters } from "@/lib/unit-cycle/overdue-filter-url";
import {
  matchesOverdueTasksFilters,
  projectNameToSlug,
} from "@/lib/unit-cycle/overdue-filter-url";
import {
  resolveUnitCycleAssigneeUserId,
  unitCycleStageClaimableByUser,
  unitCycleStageVisibleToUser,
  type WorkScopeMode,
} from "@/lib/work/personal-scope";

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
  assignedUserId: string | null;
  claimable: boolean;
};

export async function getMyStageTasks(input: {
  prisma: UnitCycleDb;
  userId: string;
  role: Role;
  agentIdForCs?: string | null;
  limit?: number;
  scope?: WorkScopeMode;
}): Promise<UnitCycleStageTaskRow[]> {
  const limit = input.limit ?? 50;
  const scope = input.scope ?? "personal";

  if (scope === "personal" && input.role === "OPERATIONS") {
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
    take: scope === "oversight" ? 500 : limit * 3,
    orderBy: { updatedAt: "desc" },
  });

  const rows: UnitCycleStageTaskRow[] = [];

  for (const cycle of cycles) {
    const activeKey = resolveActiveStageKey(cycle.stages);
    if (!activeKey) continue;

    const activeStage = cycle.stages.find((stage) => stage.stageKey === activeKey);
    if (!activeStage) continue;
    if (!["IN_PROGRESS", "BLOCKED"].includes(activeStage.status)) continue;

    if (
      !unitCycleStageVisibleToUser({
        mode: scope,
        userRole: input.role,
        userId: input.userId,
        stageKey: activeKey,
        stageOwnerRole: activeStage.ownerRole,
        assignedUserId: activeStage.assignedUserId,
        unitAgentId: cycle.unit.agentId,
        active: true,
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
      assignedUserId: activeStage.assignedUserId,
      claimable: unitCycleStageClaimableByUser({
        userRole: input.role,
        userId: input.userId,
        stageKey: activeKey,
        stageOwnerRole: activeStage.ownerRole,
        assignedUserId: activeStage.assignedUserId,
        unitAgentId: cycle.unit.agentId,
      }),
    });
  }

  return rows
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if (a.deadlineAt && b.deadlineAt) {
        return a.deadlineAt.localeCompare(b.deadlineAt);
      }
      return a.unitCode.localeCompare(b.unitCode);
    })
    .slice(0, limit);
}

export type OverdueStageRow = UnitCycleStageTaskRow & {
  daysOverdue: number;
  ownerRole: Role;
  ownerAssigneeName: string | null;
  assigneeUserId: string | null;
  unitAgentId: string | null;
};

const MS_PER_DAY = 86_400_000;

const overdueCycleInclude = {
  unit: {
    include: {
      project: true,
      agent: { select: { id: true, name: true } },
      contractWorkflow: true,
      finishing: true,
      engineeringApprovals: {
        where: { kind: "READINESS_SIGN_OFF" as const },
        select: { kind: true },
      },
    },
  },
  stages: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.UnitCycleInclude;

type OverdueCycleRow = Prisma.UnitCycleGetPayload<{
  include: typeof overdueCycleInclude;
}>;

function buildOverdueRowFromCycle(
  cycle: OverdueCycleRow,
  now: Date
): OverdueStageRow | null {
  const activeKey = resolveActiveStageKey(cycle.stages);
  if (!activeKey) return null;
  const activeStage = cycle.stages.find((stage) => stage.stageKey === activeKey);
  if (!activeStage) return null;
  if (
    !assertActiveStage(cycle.stages, activeStage.stageKey) ||
    !isStageOverdue({
      status: activeStage.status,
      deadlineAt: activeStage.deadlineAt,
      now,
    })
  ) {
    return null;
  }

  const snapshot = buildUnitOperationsSnapshot({
    unit: cycle.unit,
    contractWorkflow: cycle.unit.contractWorkflow,
    finishing: cycle.unit.finishing,
    engineeringApprovals: cycle.unit.engineeringApprovals,
  });
  const checklist = buildStageChecklist(activeStage.stageKey, snapshot);
  const daysOverdue = activeStage.deadlineAt
    ? Math.max(
        1,
        Math.floor((now.getTime() - activeStage.deadlineAt.getTime()) / MS_PER_DAY)
      )
    : 0;

  const ownerRole = activeStage.ownerRole ?? resolveStageOwnerRole(activeStage.stageKey);
  const ownerAssigneeName =
    activeStage.stageKey === "ENGINEERING"
      ? (cycle.unit.agent?.name ?? null)
      : null;
  const assigneeUserId = resolveUnitCycleAssigneeUserId({
    stageKey: activeStage.stageKey,
    assignedUserId: activeStage.assignedUserId,
    unitAgentId: cycle.unit.agent?.id ?? null,
  });

  return {
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
    ownerRole,
    ownerAssigneeName,
    assigneeUserId,
    assignedUserId: activeStage.assignedUserId,
    unitAgentId: cycle.unit.agent?.id ?? null,
    claimable: false,
  };
}

async function loadOverdueCycleRows(
  prisma: UnitCycleDb,
  limit: number
): Promise<OverdueCycleRow[]> {
  const now = new Date();
  return prisma.unitCycle.findMany({
    where: {
      unit: activeUnitWhere({ project: { unitCycleEnabled: true } }),
      stages: {
        some: {
          status: { in: ["IN_PROGRESS", "BLOCKED"] },
          deadlineAt: { lt: now },
        },
      },
    },
    include: overdueCycleInclude,
    take: limit,
    orderBy: { updatedAt: "desc" },
  });
}

export function filterOverdueStageRows(
  rows: OverdueStageRow[],
  filters: OverdueTasksPageFilters
): OverdueStageRow[] {
  const projectSlugById = new Map(
    rows.map((row) => [row.projectId, projectNameToSlug(row.projectName)])
  );
  return rows.filter((row) =>
    matchesOverdueTasksFilters(row, filters, projectSlugById)
  );
}

export function summarizeOverdueByStage(
  rows: OverdueStageRow[]
): Array<{ stageKey: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.stageKey, (counts.get(row.stageKey) ?? 0) + 1);
  }
  return ["CONTRACT", "FINANCE", "ENGINEERING", "LEGAL_HANDOVER"]
    .map((stageKey) => ({
      stageKey,
      count: counts.get(stageKey) ?? 0,
    }))
    .filter((entry) => entry.count > 0);
}

export function groupOverdueStageRows(rows: OverdueStageRow[]): Array<{
  stageKey: string;
  owners: Array<{
    ownerRole: Role;
    ownerAssigneeName: string | null;
    tasks: OverdueStageRow[];
  }>;
}> {
  const byStage = new Map<
    string,
    Map<string, { ownerRole: Role; ownerAssigneeName: string | null; tasks: OverdueStageRow[] }>
  >();

  for (const row of rows) {
    if (!byStage.has(row.stageKey)) {
      byStage.set(row.stageKey, new Map());
    }
    const ownerKey = `${row.ownerRole}:${row.ownerAssigneeName ?? ""}`;
    const stageMap = byStage.get(row.stageKey)!;
    if (!stageMap.has(ownerKey)) {
      stageMap.set(ownerKey, {
        ownerRole: row.ownerRole,
        ownerAssigneeName: row.ownerAssigneeName,
        tasks: [],
      });
    }
    stageMap.get(ownerKey)!.tasks.push(row);
  }

  return [...byStage.entries()].map(([stageKey, ownersMap]) => ({
    stageKey,
    owners: [...ownersMap.values()].sort((a, b) =>
      a.ownerRole.localeCompare(b.ownerRole)
    ),
  }));
}

export async function getOverdueStagesForManagement(
  prisma: UnitCycleDb,
  limit = 100
): Promise<OverdueStageRow[]> {
  return loadAllOverdueStageRows(prisma, limit);
}

export async function getPersonalOverdueStages(input: {
  prisma: UnitCycleDb;
  userId: string;
  role: Role;
  limit?: number;
}): Promise<OverdueStageRow[]> {
  const all = await loadAllOverdueStageRows(input.prisma, input.limit ?? 200);
  return all.filter((row) =>
    unitCycleStageVisibleToUser({
      mode: "personal",
      userRole: input.role,
      userId: input.userId,
      stageKey: row.stageKey as never,
      stageOwnerRole: row.ownerRole,
      assignedUserId: row.assignedUserId,
      unitAgentId: row.unitAgentId,
      active: true,
    }) &&
    (row.assigneeUserId == null || row.assigneeUserId === input.userId)
  );
}

async function loadAllOverdueStageRows(
  prisma: UnitCycleDb,
  limit: number
): Promise<OverdueStageRow[]> {
  const now = new Date();
  const cycles = await loadOverdueCycleRows(prisma, limit);
  const rows: OverdueStageRow[] = [];

  for (const cycle of cycles) {
    const row = buildOverdueRowFromCycle(cycle, now);
    if (row) rows.push(row);
  }

  return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export async function getFilteredOverdueStagesForManagement(
  prisma: UnitCycleDb,
  filters: OverdueTasksPageFilters,
  limit = 500
): Promise<OverdueStageRow[]> {
  const all = await getOverdueStagesForManagement(prisma, limit);
  return filterOverdueStageRows(all, filters);
}
