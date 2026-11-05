"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { withAudit } from "@/lib/audit/with-audit";
import { prisma } from "@/lib/prisma";
import { activeUnitWhere } from "@/lib/prisma/soft-delete";
import { resolveActiveStageKey } from "@/lib/operations/operations-progress";
import { recordUnitCycleAuditEvent } from "@/lib/unit-cycle/audit";
import {
  archiveGapTaskClaimableByUser,
  requestClaimableByUser,
  unitCycleStageClaimableByUser,
} from "@/lib/work/personal-scope";
import { userCanApproveAtCurrentStep } from "@/lib/requests/permissions-core";
import { getOrgStaffAvailability } from "@/lib/requests/org-staff.server";

export async function claimUnitCycleStageAction(input: {
  unitId: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const unit = await prisma.unit.findFirst({
    where: activeUnitWhere({ id: input.unitId }),
    select: {
      id: true,
      agentId: true,
      unitCycle: {
        include: { stages: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  const activeKey = unit?.unitCycle
    ? resolveActiveStageKey(unit.unitCycle.stages)
    : null;
  const activeStage = unit?.unitCycle?.stages.find(
    (stage) => stage.stageKey === activeKey
  );

  if (!unit?.unitCycle || !activeStage || !activeKey) {
    return actionFail("No active stage");
  }

  if (
    !unitCycleStageClaimableByUser({
      userRole: session.user.role,
      userId: session.user.id,
      stageKey: activeKey,
      stageOwnerRole: activeStage.ownerRole,
      assignedUserId: activeStage.assignedUserId,
      unitAgentId: unit.agentId,
    })
  ) {
    return actionFail("Cannot claim this task");
  }

  await withAudit(async () => {
    await prisma.unitCycleStage.update({
      where: { id: activeStage.id },
      data: { assignedUserId: session.user.id },
    });
    await recordUnitCycleAuditEvent({
      unitCycleId: unit.unitCycle!.id,
      stageKey: activeKey,
      userId: session.user.id,
      action: "stage_claimed",
      details: {},
    });
  });

  revalidatePath(`/units/${input.unitId}`);
  revalidatePath("/dashboard");
  revalidatePath("/legal");
  revalidatePath("/finance");
  revalidatePath("/executive");
  revalidatePath("/legal/overdue-tasks");
  revalidatePath("/finance/overdue-tasks");
  revalidatePath("/executive/overdue-tasks");
  return actionOk();
}

export async function claimUnitRequestAction(input: {
  requestId: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const staff = await getOrgStaffAvailability();
  const request = await prisma.unitRequest.findUnique({
    where: { id: input.requestId },
    select: {
      id: true,
      type: true,
      status: true,
      currentStepIndex: true,
      currentApproverKind: true,
      assignedApproverUserId: true,
    },
  });

  if (!request || request.status !== "PENDING" || !request.currentApproverKind) {
    return actionFail("Request not awaiting approval");
  }

  const canApprove = userCanApproveAtCurrentStep({
    role: session.user.role,
    request,
    staff,
  });

  if (
    !requestClaimableByUser({
      userRole: session.user.role,
      assignedApproverUserId: request.assignedApproverUserId,
      canApprove,
    })
  ) {
    return actionFail("Cannot claim this request");
  }

  await prisma.unitRequest.update({
    where: { id: request.id },
    data: { assignedApproverUserId: session.user.id },
  });

  revalidatePath("/requests");
  revalidatePath(`/requests/${request.id}`);
  revalidatePath("/legal");
  revalidatePath("/finance");
  revalidatePath("/operations");
  return actionOk();
}

export async function claimArchiveGapTaskAction(input: {
  gapTaskId: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const task = await prisma.archiveCheckGapTask.findUnique({
    where: { id: input.gapTaskId },
    select: {
      id: true,
      ownerRole: true,
      ownerUserId: true,
      status: true,
      unitRequestId: true,
    },
  });

  if (!task || task.status !== "OPEN") {
    return actionFail("Gap task not open");
  }

  if (
    !archiveGapTaskClaimableByUser({
      userRole: session.user.role,
      ownerRole: task.ownerRole,
      ownerUserId: task.ownerUserId,
    })
  ) {
    return actionFail("Cannot claim this gap task");
  }

  await prisma.archiveCheckGapTask.update({
    where: { id: task.id },
    data: { ownerUserId: session.user.id },
  });

  revalidatePath("/legal");
  revalidatePath("/finance");
  revalidatePath(`/requests/${task.unitRequestId}`);
  return actionOk();
}
