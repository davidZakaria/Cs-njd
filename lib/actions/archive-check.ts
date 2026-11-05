"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { isArchiveCheckItemKey } from "@/lib/archive-check/items";
import {
  createGapTasksForArchiveCheck,
  tryCompleteArchiveCheckRequest,
} from "@/lib/archive-check/gap-tasks";
import { operationsMayWorkArchiveCheckRequest } from "@/lib/archive-check/permissions";
import {
  loadArchiveCheckDetail,
  listActiveUnitsForProject,
  unitIncludeForArchiveSeed,
} from "@/lib/archive-check/queries";
import { seedArchiveCheckItemsForRequest } from "@/lib/archive-check/seed-items";
import { mapUnitToOperationsProgressInput } from "@/lib/operations/map-unit-to-progress-input";
import { recordRequestAuditEvent } from "@/lib/requests/audit";
import { getOrgStaffAvailability } from "@/lib/requests/org-staff.server";
import { rolesThatCanActOnApproverKind } from "@/lib/requests/approver-roles";
import type { UnitRequestApproverKind } from "@prisma/client";
import {
  buildSubmitState,
  computeDefaultDueDate,
} from "@/lib/requests/workflow-helpers";
import { canCreateUnitRequest } from "@/lib/requests/permissions.server";
import { prisma, basePrisma, activeUnitWhere } from "@/lib/prisma";
import {
  buildRequestAttachmentStoredFilename,
  isAllowedRequestAttachmentMime,
  REQUEST_ATTACHMENT_MAX_BYTES,
  writeRequestAttachmentFile,
} from "@/lib/uploads/request-attachment-storage";
import type { ArchiveCheckItemStatus } from "@prisma/client";

const bulkSchema = z.object({
  projectId: z.string().min(1),
  description: z.string().max(4000).optional(),
});

const itemStatusSchema = z.object({
  requestId: z.string().min(1),
  itemKey: z.string().min(1),
  status: z.enum(["FOUND", "MISSING", "UNSIGNED"]),
});

const submitSchema = z.object({
  requestId: z.string().min(1),
});

const gapCompleteSchema = z.object({
  gapTaskId: z.string().min(1),
});

function ownerRoleToApproverKind(
  role: import("@prisma/client").Role
): UnitRequestApproverKind | null {
  if (role === "LEGAL") return "LEGAL";
  if (role === "FINANCE") return "FINANCE";
  if (role === "MANAGEMENT") return "MANAGEMENT";
  return null;
}

async function loadUnitForArchiveSeed(unitId: string) {
  return prisma.unit.findFirst({
    where: activeUnitWhere({ id: unitId }),
    include: unitIncludeForArchiveSeed,
  });
}

export async function createBulkArchiveCheckAction(
  input: z.input<typeof bulkSchema>
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user || !canCreateUnitRequest(session.user.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    select: { id: true, name: true },
  });
  if (!project) return { success: false, error: "Project not found" };

  const units = await listActiveUnitsForProject(project.id);
  if (units.length === 0) {
    return { success: false, error: "No active units in this project" };
  }

  const submit = buildSubmitState("ARCHIVE_CHECK");
  const dueDate = computeDefaultDueDate(new Date());
  const anchorUnitId = units[0]!.id;

  const parent = await prisma.unitRequest.create({
    data: {
      type: "ARCHIVE_CHECK",
      unitId: anchorUnitId,
      requestedById: session.user.id,
      status: "DRAFT",
      description: parsed.data.description?.trim() || null,
      dueDate,
      bulkProjectId: project.id,
      currentStepIndex: submit.currentStepIndex,
      currentApproverKind: submit.currentApproverKind,
      unitCycleStageKey: null,
    },
  });

  for (const unit of units) {
    const child = await prisma.unitRequest.create({
      data: {
        type: "ARCHIVE_CHECK",
        unitId: unit.id,
        clientId: unit.clientId,
        requestedById: session.user.id,
        status: "DRAFT",
        parentRequestId: parent.id,
        dueDate,
        currentStepIndex: submit.currentStepIndex,
        currentApproverKind: submit.currentApproverKind,
        unitCycleStageKey: submit.unitCycleStageKey,
      },
    });

    const unitRow = await loadUnitForArchiveSeed(unit.id);
    if (unitRow) {
      await seedArchiveCheckItemsForRequest({
        prisma,
        unitRequestId: child.id,
        progressInput: mapUnitToOperationsProgressInput(unitRow),
      });
    }
  }

  await recordRequestAuditEvent({
    requestId: parent.id,
    userId: session.user.id,
    action: "archive_check_bulk_created",
    details: { projectId: project.id, unitCount: units.length },
  });

  revalidatePath("/requests");
  return { success: true, id: parent.id };
}

export async function updateArchiveCheckItemStatusAction(
  input: z.input<typeof itemStatusSchema>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = itemStatusSchema.safeParse(input);
  if (!parsed.success) return actionFail("Invalid input");
  if (!isArchiveCheckItemKey(parsed.data.itemKey)) {
    return actionFail("Invalid checklist item");
  }

  const request = await prisma.unitRequest.findUnique({
    where: { id: parsed.data.requestId },
  });
  if (!request) return actionFail("Request not found");

  if (
    !operationsMayWorkArchiveCheckRequest(session.user.role, {
      type: request.type,
      status: request.status,
      currentApproverKind: request.currentApproverKind,
      archiveCheckSubmittedAt: request.archiveCheckSubmittedAt,
      parentRequestId: request.parentRequestId,
      bulkProjectId: request.bulkProjectId,
    })
  ) {
    return actionFail("Unauthorized");
  }

  await prisma.archiveCheckItem.update({
    where: {
      unitRequestId_itemKey: {
        unitRequestId: request.id,
        itemKey: parsed.data.itemKey,
      },
    },
    data: { status: parsed.data.status as ArchiveCheckItemStatus },
  });

  revalidatePath(`/operations/archive-checks/${request.id}`);
  revalidatePath(`/requests/${request.id}`);
  if (request.parentRequestId) {
    revalidatePath(`/requests/${request.parentRequestId}`);
  }
  return actionOk(undefined);
}

export async function submitArchiveCheckOperationsAction(
  input: z.input<typeof submitSchema>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return actionFail("Invalid input");

  const request = await prisma.unitRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: { archiveCheckItems: true },
  });
  if (!request) return actionFail("Request not found");

  if (
    !operationsMayWorkArchiveCheckRequest(session.user.role, {
      type: request.type,
      status: request.status,
      currentApproverKind: request.currentApproverKind,
      archiveCheckSubmittedAt: request.archiveCheckSubmittedAt,
      parentRequestId: request.parentRequestId,
      bulkProjectId: request.bulkProjectId,
    })
  ) {
    return actionFail("Unauthorized");
  }

  const pendingItems = request.archiveCheckItems.filter(
    (item) => item.status === "PENDING"
  );
  if (pendingItems.length > 0) {
    return actionFail("Mark every checklist item before submitting");
  }

  const staff = await getOrgStaffAvailability(basePrisma);
  const now = new Date();

  await prisma.unitRequest.update({
    where: { id: request.id },
    data: {
      archiveCheckSubmittedAt: now,
      currentApproverKind: null,
    },
  });

  const gapCount = await createGapTasksForArchiveCheck({
    prisma,
    unitRequestId: request.id,
    staff,
    now,
  });

  if (gapCount === 0) {
    await tryCompleteArchiveCheckRequest({
      prisma,
      unitRequestId: request.id,
      resolvedById: session.user.id,
      now,
    });
  }

  await recordRequestAuditEvent({
    requestId: request.id,
    userId: session.user.id,
    action: "archive_check_submitted",
    details: { gapCount },
  });

  if (request.parentRequestId) {
    await maybeCompleteBulkArchiveCheckParent(request.parentRequestId, session.user.id);
  }

  revalidatePath("/operations");
  revalidatePath(`/operations/archive-checks/${request.id}`);
  revalidatePath(`/requests/${request.id}`);
  revalidatePath(`/units/${request.unitId}`);
  return actionOk(undefined);
}

async function maybeCompleteBulkArchiveCheckParent(
  parentId: string,
  userId: string
) {
  const children = await prisma.unitRequest.findMany({
    where: { parentRequestId: parentId },
    select: { id: true, status: true },
  });
  if (children.length === 0) return;
  if (children.some((child) => child.status !== "APPROVED")) return;

  await prisma.unitRequest.update({
    where: { id: parentId },
    data: {
      status: "APPROVED",
      resolvedAt: new Date(),
      resolvedById: userId,
      currentApproverKind: null,
    },
  });
  revalidatePath(`/requests/${parentId}`);
}

export async function completeArchiveCheckGapTaskAction(
  input: z.input<typeof gapCompleteSchema>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = gapCompleteSchema.safeParse(input);
  if (!parsed.success) return actionFail("Invalid input");

  const task = await prisma.archiveCheckGapTask.findUnique({
    where: { id: parsed.data.gapTaskId },
    include: {
      unitRequest: { select: { id: true, unitId: true, parentRequestId: true } },
    },
  });
  if (!task || task.status !== "OPEN") return actionFail("Task not found");

  const staff = await getOrgStaffAvailability(basePrisma);
  const approverKind = ownerRoleToApproverKind(task.ownerRole);
  if (
    !approverKind ||
    !rolesThatCanActOnApproverKind(approverKind, staff).includes(
      session.user.role
    )
  ) {
    return actionFail("Unauthorized");
  }

  const now = new Date();
  await prisma.archiveCheckGapTask.update({
    where: { id: task.id },
    data: {
      status: "COMPLETED",
      completedAt: now,
      completedById: session.user.id,
    },
  });

  await tryCompleteArchiveCheckRequest({
    prisma,
    unitRequestId: task.unitRequestId,
    resolvedById: session.user.id,
    now,
  });

  await recordRequestAuditEvent({
    requestId: task.unitRequestId,
    userId: session.user.id,
    action: "archive_gap_completed",
    details: { itemKey: task.itemKey, gapTaskId: task.id },
  });

  if (task.unitRequest.parentRequestId) {
    await maybeCompleteBulkArchiveCheckParent(
      task.unitRequest.parentRequestId,
      session.user.id
    );
  }

  revalidatePath(`/requests/${task.unitRequestId}`);
  revalidatePath(`/units/${task.unitRequest.unitId}`);
  revalidatePath("/legal");
  revalidatePath("/finance");
  return actionOk(undefined);
}

export async function uploadArchiveCheckScanAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const requestId = String(formData.get("requestId") ?? "");
  const itemKey = String(formData.get("itemKey") ?? "");
  const file = formData.get("file");

  if (!requestId || !isArchiveCheckItemKey(itemKey)) {
    return actionFail("Invalid input");
  }
  if (!(file instanceof File)) return actionFail("No file provided");

  const request = await prisma.unitRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) return actionFail("Request not found");

  if (
    !operationsMayWorkArchiveCheckRequest(session.user.role, {
      type: request.type,
      status: request.status,
      currentApproverKind: request.currentApproverKind,
      archiveCheckSubmittedAt: request.archiveCheckSubmittedAt,
      parentRequestId: request.parentRequestId,
      bulkProjectId: request.bulkProjectId,
    })
  ) {
    return actionFail("Unauthorized");
  }

  if (file.size === 0) return actionFail("File is empty");
  if (file.size > REQUEST_ATTACHMENT_MAX_BYTES) {
    return actionFail("File exceeds size limit");
  }
  if (!isAllowedRequestAttachmentMime(file.type)) {
    return actionFail("File type not allowed");
  }

  const storedName = buildRequestAttachmentStoredFilename(requestId, file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeRequestAttachmentFile(storedName, bytes);

  await prisma.requestAttachment.create({
    data: {
      requestId,
      storedName,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedById: session.user.id,
      archiveCheckItemKey: itemKey,
    },
  });

  await recordRequestAuditEvent({
    requestId,
    userId: session.user.id,
    action: "archive_scan_uploaded",
    details: { itemKey, originalName: file.name },
  });

  revalidatePath(`/operations/archive-checks/${requestId}`);
  return actionOk(undefined);
}

export async function getArchiveCheckDetailForViewer(requestId: string) {
  const session = await auth();
  if (!session?.user) return null;
  return loadArchiveCheckDetail(requestId);
}
