"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { withAudit } from "@/lib/audit/with-audit";
import { prisma } from "@/lib/prisma";
import { activeUnitWhere } from "@/lib/prisma";
import {
  buildStageChecklist,
  resolveActiveStageKey,
} from "@/lib/operations/operations-progress";
import { recordUnitCycleAuditEvent } from "@/lib/unit-cycle/audit";
import {
  computeStageDeadline,
  deadlineDaysForStage,
} from "@/lib/unit-cycle/deadlines";
import { ensureUnitCycleForUnit } from "@/lib/unit-cycle/ensure-cycle";
import {
  managementRolesForCycle,
  roleCanOwnStage,
} from "@/lib/unit-cycle/owners";
import { buildUnitOperationsSnapshot } from "@/lib/unit-cycle/snapshot";
import {
  assertActiveStage,
  canCompleteStage,
  nextStageKey,
} from "@/lib/unit-cycle/stage-rules";
import {
  OPEN_UNIT_REQUEST_STATUSES,
  blockingRequestsForStage,
  type UnitRequestStageBlocker,
} from "@/lib/unit-cycle/stage-request-blocking";
import { loadOpenArchiveGapTasksForUnit } from "@/lib/archive-check/queries";
import { mergeUnitCycleBlockerBanner } from "@/lib/archive-check/blocking-banner";
import {
  blockingGapTasksForStage,
} from "@/lib/archive-check/stage-blocking";

const projectSettingsSchema = z.object({
  projectId: z.string().min(1),
  unitCycleEnabled: z.boolean(),
  unitCycleContractDeadlineDays: z.number().int().min(1).max(90),
  unitCycleFinanceDeadlineDays: z.number().int().min(1).max(90),
  unitCycleEngineeringDeadlineDays: z.number().int().min(1).max(90),
  unitCycleLegalHandoverDeadlineDays: z.number().int().min(1).max(90),
});

export async function updateProjectUnitCycleSettingsAction(
  input: z.infer<typeof projectSettingsSchema>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !managementRolesForCycle().includes(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const parsed = projectSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await withAudit(async () => {
    await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: {
        unitCycleEnabled: parsed.data.unitCycleEnabled,
        unitCycleContractDeadlineDays: parsed.data.unitCycleContractDeadlineDays,
        unitCycleFinanceDeadlineDays: parsed.data.unitCycleFinanceDeadlineDays,
        unitCycleEngineeringDeadlineDays:
          parsed.data.unitCycleEngineeringDeadlineDays,
        unitCycleLegalHandoverDeadlineDays:
          parsed.data.unitCycleLegalHandoverDeadlineDays,
      },
    });
  });

  revalidatePath("/executive/project-settings");
  revalidatePath("/executive");
  return actionOk();
}

const stageStatusSchema = z.object({
  unitId: z.string().min(1),
  blockedReason: z.string().max(500).optional(),
});

export async function blockUnitCycleStageAction(
  input: z.infer<typeof stageStatusSchema>
): Promise<ActionResult> {
  return updateActiveStageStatus(input, "BLOCKED");
}

const unblockStageSchema = z.object({ unitId: z.string().min(1) });

export async function unblockUnitCycleStageAction(
  input: z.infer<typeof unblockStageSchema>
): Promise<ActionResult> {
  return updateActiveStageStatus(input, "IN_PROGRESS");
}

async function updateActiveStageStatus(
  input: { unitId: string; blockedReason?: string },
  status: "BLOCKED" | "IN_PROGRESS"
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const unit = await prisma.unit.findFirst({
    where: activeUnitWhere({ id: input.unitId }),
    include: {
      project: true,
      unitCycle: { include: { stages: { orderBy: { sortOrder: "asc" } } } },
    },
  });

  if (!unit?.project.unitCycleEnabled || !unit.unitCycle) {
    return actionFail("Unit cycle not enabled");
  }

  const activeKey = resolveActiveStageKey(unit.unitCycle.stages);
  if (!activeKey) return actionFail("Cycle already complete");

  if (!roleCanOwnStage(session.user.role, activeKey)) {
    return actionFail("Unauthorized");
  }

  const stage = unit.unitCycle.stages.find((row) => row.stageKey === activeKey);
  if (!stage || stage.status === "DONE") {
    return actionFail("Stage not active");
  }

  await withAudit(async () => {
    await prisma.unitCycleStage.update({
      where: { id: stage.id },
      data: {
        status,
        blockedReason:
          status === "BLOCKED" ? (input.blockedReason?.trim() || null) : null,
      },
    });

    await recordUnitCycleAuditEvent({
      unitCycleId: unit.unitCycle!.id,
      stageKey: activeKey,
      userId: session.user.id,
      action: status === "BLOCKED" ? "stage_blocked" : "stage_unblocked",
      details: { blockedReason: input.blockedReason ?? null },
    });
  });

  revalidateUnitCyclePaths(unit.id);
  return actionOk();
}

export async function completeUnitCycleStageAction(input: {
  unitId: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const unit = await prisma.unit.findFirst({
    where: activeUnitWhere({ id: input.unitId }),
    include: {
      project: true,
      contractWorkflow: true,
      finishing: true,
      engineeringApprovals: {
        where: { kind: "READINESS_SIGN_OFF" },
        select: { kind: true },
      },
      unitCycle: { include: { stages: { orderBy: { sortOrder: "asc" } } } },
    },
  });

  if (!unit?.project.unitCycleEnabled || !unit.unitCycle) {
    return actionFail("Unit cycle not enabled");
  }

  const activeKey = resolveActiveStageKey(unit.unitCycle.stages);
  if (!activeKey) return actionFail("Cycle already complete");
  if (!assertActiveStage(unit.unitCycle.stages, activeKey)) {
    return actionFail("Invalid active stage");
  }

  if (!roleCanOwnStage(session.user.role, activeKey)) {
    return actionFail("Unauthorized");
  }

  const stage = unit.unitCycle.stages.find((row) => row.stageKey === activeKey);
  if (!stage) return actionFail("Stage not found");

  const snapshot = buildUnitOperationsSnapshot({
    unit,
    contractWorkflow: unit.contractWorkflow,
    finishing: unit.finishing,
    engineeringApprovals: unit.engineeringApprovals,
  });

  if (!canCompleteStage(activeKey, stage.status, snapshot, {
    unitCycleEnabled: true,
    openRequests: await loadOpenUnitRequestBlockers(unit.id),
    openGapTasks: await loadOpenArchiveGapTasksForUnit(unit.id),
  })) {
    return actionFail("Checklist incomplete or blocked by open request");
  }

  const following = nextStageKey(activeKey);
  const now = new Date();

  await withAudit(async () => {
    await prisma.unitCycleStage.update({
      where: { id: stage.id },
      data: {
        status: "DONE",
        completedAt: now,
        completedByUserId: session.user.id,
        blockedReason: null,
      },
    });

    if (following) {
      const nextStage = unit.unitCycle!.stages.find(
        (row) => row.stageKey === following
      );
      if (nextStage) {
        await prisma.unitCycleStage.update({
          where: { id: nextStage.id },
          data: {
            status: "IN_PROGRESS",
            startedAt: now,
            deadlineAt: computeStageDeadline(
              now,
              deadlineDaysForStage(unit.project, following)
            ),
          },
        });
      }
    }

    await recordUnitCycleAuditEvent({
      unitCycleId: unit.unitCycle!.id,
      stageKey: activeKey,
      userId: session.user.id,
      action: "stage_completed",
      details: { nextStage: following },
    });
  });

  revalidateUnitCyclePaths(unit.id);
  return actionOk();
}

export async function loadUnitCycleForUnit(unitId: string) {
  const unit = await prisma.unit.findFirst({
    where: activeUnitWhere({ id: unitId }),
    include: {
      project: true,
      contractWorkflow: true,
      finishing: true,
      engineeringApprovals: {
        where: { kind: "READINESS_SIGN_OFF" },
        select: { kind: true },
      },
      unitCycle: {
        include: {
          stages: { orderBy: { sortOrder: "asc" } },
          events: { orderBy: { createdAt: "desc" }, take: 30 },
        },
      },
    },
  });

  if (!unit?.project.unitCycleEnabled) {
    return null;
  }

  if (!unit.unitCycle) {
    await ensureUnitCycleForUnit(prisma, {
      unitId: unit.id,
      project: unit.project,
    });
    return loadUnitCycleForUnit(unitId);
  }

  const snapshot = buildUnitOperationsSnapshot({
    unit,
    contractWorkflow: unit.contractWorkflow,
    finishing: unit.finishing,
    engineeringApprovals: unit.engineeringApprovals,
  });

  const openRequests = await loadOpenUnitRequestBlockers(unitId);
  const openGapTasks = await loadOpenArchiveGapTasksForUnit(unitId);
  const activeStageKey = resolveActiveStageKey(unit.unitCycle.stages);

  const stages = unit.unitCycle.stages.map((stage) => {
    const checklist = buildStageChecklist(stage.stageKey, snapshot);
    const checklistComplete = checklist.every((item) => item.passed);
    const stageBlockers = blockingRequestsForStage(
      stage.stageKey,
      openRequests,
      true
    );
    const gapBlockers = blockingGapTasksForStage(
      stage.stageKey,
      openGapTasks,
      true
    );
    return {
      ...stage,
      checklist,
      checklistComplete,
      blockedByRequest: stageBlockers.length > 0 || gapBlockers.length > 0,
    };
  });

  const activeRequestBlockers =
    activeStageKey != null
      ? blockingRequestsForStage(activeStageKey, openRequests, true)
      : [];
  const activeGapBlockers =
    activeStageKey != null
      ? blockingGapTasksForStage(activeStageKey, openGapTasks, true)
      : [];

  const blockingBannerEntries =
    activeStageKey != null
      ? mergeUnitCycleBlockerBanner({
          openRequests: activeRequestBlockers,
          openGapTasks: activeGapBlockers,
        })
      : [];

  return {
    unitCycleId: unit.unitCycle.id,
    activeStageKey: resolveActiveStageKey(stages),
    stages,
    events: unit.unitCycle.events,
    blockingRequests: activeRequestBlockers,
    blockingGapTasks: activeGapBlockers,
    blockingBannerEntries,
  };
}

async function loadOpenUnitRequestBlockers(
  unitId: string
): Promise<UnitRequestStageBlocker[]> {
  const rows = await prisma.unitRequest.findMany({
    where: {
      unitId,
      status: { in: OPEN_UNIT_REQUEST_STATUSES },
      NOT: {
        bulkProjectId: { not: null },
        parentRequestId: null,
      },
    },
    select: {
      id: true,
      type: true,
      status: true,
      unitCycleStageKey: true,
    },
  });
  return rows;
}

function revalidateUnitCyclePaths(unitId: string) {
  revalidatePath(`/units/${unitId}`);
  revalidatePath("/dashboard");
  revalidatePath("/executive");
  revalidatePath("/legal");
  revalidatePath("/finance");
}
