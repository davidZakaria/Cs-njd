"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { resolveCsAgentScope } from "@/lib/auth/cs-agent-scope";
import { prisma } from "@/lib/prisma";
import { recordRequestAuditEvent } from "@/lib/requests/audit";
import {
  canAddRequestComment,
  canCancelRequest,
  canCreateUnitRequest,
  canEditDraftRequest,
  canUploadRequestAttachment,
  canViewUnitRequest,
  userCanApproveAtCurrentStep,
  userCanRejectAtCurrentStep,
} from "@/lib/requests/permissions";
import {
  advanceAfterApproval,
  buildSubmitState,
  computeDefaultDueDate,
  engineeringKindForRequestType,
} from "@/lib/requests/workflow-helpers";
import { recordUnitEngineeringApproval } from "@/lib/workflow/engineering-approval-log";
import {
  buildRequestAttachmentStoredFilename,
  isAllowedRequestAttachmentMime,
  REQUEST_ATTACHMENT_MAX_BYTES,
  writeRequestAttachmentFile,
} from "@/lib/uploads/request-attachment-storage";
import { UnitRequestType } from "@prisma/client";

const createSchema = z.object({
  unitId: z.string().min(1),
  type: z.nativeEnum(UnitRequestType),
  description: z.string().max(4000).optional(),
  dueDate: z.string().optional(),
  linkedSwapTargetUnitId: z.string().optional(),
});

const idSchema = z.object({
  requestId: z.string().min(1),
});

const commentSchema = idSchema.extend({
  body: z.string().min(1).max(2000),
});

const decisionSchema = idSchema.extend({
  note: z.string().max(2000).optional(),
});

async function loadRequestContext(requestId: string) {
  return prisma.unitRequest.findUnique({
    where: { id: requestId },
    include: {
      unit: { include: { project: true, client: true } },
      requestedBy: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
      attachments: { orderBy: { createdAt: "asc" } },
      auditEvents: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}

function parseDueDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createUnitRequestAction(
  input: z.input<typeof createSchema>
): Promise<
  | { success: true; id: string }
  | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user || !canCreateUnitRequest(session.user.role)) {
    return { success: false as const, error: "Unauthorized" };
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const unit = await prisma.unit.findUnique({
    where: { id: parsed.data.unitId },
    select: { id: true, clientId: true, deletedAt: true },
  });
  if (!unit || unit.deletedAt) return { success: false as const, error: "Unit not found" };

  if (
    parsed.data.type === "UNIT_SWAP" &&
    !parsed.data.linkedSwapTargetUnitId
  ) {
    return { success: false as const, error: "Target unit is required for unit swap requests" };
  }

  const submit = buildSubmitState(parsed.data.type);
  const dueDate =
    parseDueDate(parsed.data.dueDate) ?? computeDefaultDueDate(new Date());

  const created = await prisma.unitRequest.create({
    data: {
      type: parsed.data.type,
      unitId: unit.id,
      clientId: unit.clientId,
      requestedById: session.user.id,
      status: "DRAFT",
      description: parsed.data.description?.trim() || null,
      dueDate,
      linkedSwapTargetUnitId: parsed.data.linkedSwapTargetUnitId ?? null,
      currentStepIndex: submit.currentStepIndex,
      currentApproverKind: submit.currentApproverKind,
      unitCycleStageKey: submit.unitCycleStageKey,
    },
  });

  await recordRequestAuditEvent({
    requestId: created.id,
    userId: session.user.id,
    action: "created",
    details: { type: created.type },
  });

  revalidatePath("/requests");
  revalidatePath(`/units/${unit.id}`);
  return { success: true as const, id: created.id };
}

export async function submitUnitRequestAction(
  input: z.input<typeof idSchema>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return actionFail("Invalid input");

  const request = await prisma.unitRequest.findUnique({
    where: { id: parsed.data.requestId },
  });
  if (!request) return actionFail("Request not found");
  if (request.status !== "DRAFT") return actionFail("Request is not a draft");

  if (
    !canEditDraftRequest({
      role: session.user.role,
      userId: session.user.id,
      requestedById: request.requestedById,
    })
  ) {
    return actionFail("Unauthorized");
  }

  const submit = buildSubmitState(request.type);
  const now = new Date();

  await prisma.unitRequest.update({
    where: { id: request.id },
    data: {
      status: "PENDING",
      submittedAt: now,
      currentStepIndex: submit.currentStepIndex,
      currentApproverKind: submit.currentApproverKind,
      dueDate: request.dueDate ?? computeDefaultDueDate(now),
    },
  });

  await recordRequestAuditEvent({
    requestId: request.id,
    userId: session.user.id,
    action: "submitted",
  });

  revalidatePath("/requests");
  revalidatePath(`/units/${request.unitId}`);
  revalidatePath(`/requests/${request.id}`);
  return actionOk(undefined);
}

export async function approveUnitRequestStepAction(
  input: z.input<typeof decisionSchema>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return actionFail("Invalid input");

  const request = await prisma.unitRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: { unit: { select: { agentId: true } } },
  });
  if (!request) return actionFail("Request not found");
  if (request.status !== "PENDING") return actionFail("Request is not pending");

  const csScope =
    session.user.role === "CS_AGENT"
      ? await resolveCsAgentScope(session.user)
      : null;

  if (
    !userCanApproveAtCurrentStep({
      role: session.user.role,
      userId: session.user.id,
      request,
      unitAgentId: request.unit.agentId,
      csScope,
    })
  ) {
    return actionFail("Unauthorized");
  }

  const advance = advanceAfterApproval({
    type: request.type,
    currentStepIndex: request.currentStepIndex,
  });

  const now = new Date();
  let engineeringApprovalId = request.engineeringApprovalId;

  const engKind = engineeringKindForRequestType(request.type);
  if (engKind && !engineeringApprovalId) {
    const approval = await recordUnitEngineeringApproval({
      unitId: request.unitId,
      approvedById: session.user.id,
      kind: engKind,
      summary: parsed.data.note?.trim() || request.description,
      payload: { unitRequestId: request.id, type: request.type },
    });
    engineeringApprovalId = approval.id;
  }

  if (advance.done) {
    await prisma.unitRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        resolvedAt: now,
        resolvedById: session.user.id,
        currentApproverKind: null,
        engineeringApprovalId,
      },
    });
    await recordRequestAuditEvent({
      requestId: request.id,
      userId: session.user.id,
      action: "approved",
      details: { note: parsed.data.note ?? null, final: true },
    });
  } else {
    await prisma.unitRequest.update({
      where: { id: request.id },
      data: {
        currentStepIndex: advance.nextStepIndex,
        currentApproverKind: advance.nextApproverKind,
        engineeringApprovalId,
      },
    });
    await recordRequestAuditEvent({
      requestId: request.id,
      userId: session.user.id,
      action: "step_approved",
      details: {
        note: parsed.data.note ?? null,
        stepIndex: request.currentStepIndex,
        nextStepIndex: advance.nextStepIndex,
      },
    });
  }

  revalidatePath("/requests");
  revalidatePath(`/units/${request.unitId}`);
  revalidatePath(`/requests/${request.id}`);
  return actionOk(undefined);
}

export async function rejectUnitRequestAction(
  input: z.input<typeof decisionSchema>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return actionFail("Invalid input");

  const request = await prisma.unitRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: { unit: { select: { agentId: true } } },
  });
  if (!request) return actionFail("Request not found");
  if (request.status !== "PENDING") return actionFail("Request is not pending");

  const csScope =
    session.user.role === "CS_AGENT"
      ? await resolveCsAgentScope(session.user)
      : null;

  if (
    !userCanRejectAtCurrentStep({
      role: session.user.role,
      userId: session.user.id,
      request,
      unitAgentId: request.unit.agentId,
      csScope,
    })
  ) {
    return actionFail("Unauthorized");
  }

  await prisma.unitRequest.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      resolvedAt: new Date(),
      resolvedById: session.user.id,
      currentApproverKind: null,
    },
  });

  await recordRequestAuditEvent({
    requestId: request.id,
    userId: session.user.id,
    action: "rejected",
    details: { note: parsed.data.note ?? null },
  });

  revalidatePath("/requests");
  revalidatePath(`/units/${request.unitId}`);
  revalidatePath(`/requests/${request.id}`);
  return actionOk(undefined);
}

export async function cancelUnitRequestAction(
  input: z.input<typeof idSchema>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return actionFail("Invalid input");

  const request = await prisma.unitRequest.findUnique({
    where: { id: parsed.data.requestId },
  });
  if (!request) return actionFail("Request not found");

  if (
    !canCancelRequest({
      role: session.user.role,
      userId: session.user.id,
      requestedById: request.requestedById,
      status: request.status,
    })
  ) {
    return actionFail("Unauthorized");
  }

  await prisma.unitRequest.update({
    where: { id: request.id },
    data: {
      status: "CANCELLED",
      resolvedAt: new Date(),
      resolvedById: session.user.id,
      currentApproverKind: null,
    },
  });

  await recordRequestAuditEvent({
    requestId: request.id,
    userId: session.user.id,
    action: "cancelled",
  });

  revalidatePath("/requests");
  revalidatePath(`/units/${request.unitId}`);
  revalidatePath(`/requests/${request.id}`);
  return actionOk(undefined);
}

export async function addUnitRequestCommentAction(
  input: z.input<typeof commentSchema>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return actionFail("Invalid input");

  const request = await prisma.unitRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: { unit: { select: { agentId: true } } },
  });
  if (!request) return actionFail("Request not found");

  const csScope =
    session.user.role === "CS_AGENT"
      ? await resolveCsAgentScope(session.user)
      : null;

  if (
    !canAddRequestComment({
      role: session.user.role,
      userId: session.user.id,
      request,
      unitAgentId: request.unit.agentId,
      csScope,
    })
  ) {
    return actionFail("Unauthorized");
  }

  await prisma.requestComment.create({
    data: {
      requestId: request.id,
      authorId: session.user.id,
      body: parsed.data.body.trim(),
    },
  });

  await recordRequestAuditEvent({
    requestId: request.id,
    userId: session.user.id,
    action: "comment_added",
  });

  revalidatePath(`/requests/${request.id}`);
  return actionOk(undefined);
}

export async function uploadUnitRequestAttachmentAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const requestId = String(formData.get("requestId") ?? "");
  const file = formData.get("file");
  if (!requestId) return actionFail("Request is required");
  if (!(file instanceof File)) return actionFail("No file provided");

  const request = await prisma.unitRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) return actionFail("Request not found");

  if (
    !canUploadRequestAttachment({
      role: session.user.role,
      userId: session.user.id,
      requestedById: request.requestedById,
      status: request.status,
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

  const storedName = buildRequestAttachmentStoredFilename(
    requestId,
    file.name
  );
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
    },
  });

  await recordRequestAuditEvent({
    requestId,
    userId: session.user.id,
    action: "attachment_added",
    details: { originalName: file.name },
  });

  revalidatePath(`/requests/${requestId}`);
  return actionOk(undefined);
}

export async function getUnitRequestDetailAction(requestId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const request = await loadRequestContext(requestId);
  if (!request) return null;

  const csScope =
    session.user.role === "CS_AGENT"
      ? await resolveCsAgentScope(session.user)
      : null;

  if (
    !canViewUnitRequest({
      role: session.user.role,
      userId: session.user.id,
      request,
      unitAgentId: request.unit.agentId,
      csScope,
    })
  ) {
    return null;
  }

  return request;
}

export async function listUnitRequestsForUnit(unitId: string) {
  const session = await auth();
  if (!session?.user) return [];

  const csScope =
    session.user.role === "CS_AGENT"
      ? await resolveCsAgentScope(session.user)
      : null;

  const rows = await prisma.unitRequest.findMany({
    where: { unitId },
    orderBy: { updatedAt: "desc" },
    include: {
      requestedBy: { select: { id: true, name: true } },
      unit: { select: { agentId: true } },
    },
  });

  return rows.filter((request) =>
    canViewUnitRequest({
      role: session.user!.role,
      userId: session.user!.id,
      request,
      unitAgentId: request.unit.agentId,
      csScope,
    })
  );
}
