"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import {
  notifyRequesterArchiveFileItemOutcome,
  tryCompleteArchiveFileRequest,
} from "@/lib/archive-file-request/complete";
import {
  archiveFileKindToUnitDocumentKind,
} from "@/lib/archive-file-request/links";
import {
  canAccessOperationsArchiveFileInbox,
  operationsMayFulfillArchiveFileRequest,
} from "@/lib/archive-file-request/permissions";
import {
  countUnreadOperationsArchiveFileInbox,
  loadArchiveFileRequestDetail,
  loadOperationsArchiveFileInbox,
  sortInboxRowsForDisplay,
} from "@/lib/archive-file-request/queries";
import { withAudit } from "@/lib/audit/with-audit";
import { recordRequestAuditEvent } from "@/lib/requests/audit";
import { prisma, basePrisma } from "@/lib/prisma";
import { auditContext } from "@/lib/prisma/audit-context";
import { recordAuditLog } from "@/lib/prisma/record-audit-log";
import {
  buildNationalIdStoredFilename,
  isAllowedNationalIdMime,
  NATIONAL_ID_MAX_BYTES,
  writeNationalIdFile,
} from "@/lib/uploads/national-id-storage";
import {
  buildRequestAttachmentStoredFilename,
  isAllowedRequestAttachmentMime,
  REQUEST_ATTACHMENT_MAX_BYTES,
  writeRequestAttachmentFile,
} from "@/lib/uploads/request-attachment-storage";
import {
  buildUnitDocumentStoredFilename,
  isAllowedUnitDocumentMime,
  UNIT_DOCUMENT_MAX_BYTES,
  writeUnitDocumentFile,
  type UnitDocumentKind,
} from "@/lib/uploads/unit-document-storage";
import { ArchiveFileKind } from "@prisma/client";

const markReadSchema = z.object({
  requestId: z.string().min(1),
  skipRevalidate: z.boolean().optional(),
});

const notFoundSchema = z.object({
  itemId: z.string().min(1),
  note: z.string().min(1).max(2000),
});

export type OperationsArchiveFileInboxItem = {
  id: string;
  unitId: string | null;
  unitCode: string;
  projectName: string;
  priority: "NORMAL" | "URGENT";
  description: string | null;
  requestedByName: string;
  submittedAt: string | null;
  createdAt: string;
  isUnread: boolean;
  fileKinds: ArchiveFileKind[];
  pendingCount: number;
};

export async function getOperationsArchiveFileInboxAction(): Promise<
  ActionResult & { items?: OperationsArchiveFileInboxItem[] }
> {
  const session = await auth();
  if (!session?.user || !canAccessOperationsArchiveFileInbox(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const rows = await loadOperationsArchiveFileInbox(session.user.id);
  const sorted = sortInboxRowsForDisplay(rows);

  return {
    success: true,
    items: sorted.map((row) => ({
      id: row.id,
      unitId: row.unitId,
      unitCode: row.unit?.unitCode ?? "—",
      projectName: row.unit?.project.name ?? "—",
      priority: row.archiveFilePriority ?? "NORMAL",
      description: row.description,
      requestedByName: row.requestedBy.name,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      isUnread: row.isUnread,
      fileKinds: row.archiveFileItems.map((i) => i.fileKind),
      pendingCount: row.archiveFileItems.filter((i) => i.status === "PENDING").length,
    })),
  };
}

export async function getUnreadOperationsArchiveFileInboxCountAction(): Promise<number> {
  const session = await auth();
  if (!session?.user || !canAccessOperationsArchiveFileInbox(session.user.role)) {
    return 0;
  }
  return countUnreadOperationsArchiveFileInbox(session.user.id);
}

export async function markOperationsArchiveFileRequestReadAction(
  input: z.input<typeof markReadSchema> & { skipRevalidate?: boolean }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !canAccessOperationsArchiveFileInbox(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) return actionFail("Invalid input");

  const request = await prisma.unitRequest.findFirst({
    where: { id: parsed.data.requestId, type: "ARCHIVE_FILE_REQUEST" },
    select: { id: true },
  });
  if (!request) return actionFail("Request not found");

  await prisma.operationsArchiveFileRequestRead.upsert({
    where: {
      userId_unitRequestId: {
        userId: session.user.id,
        unitRequestId: request.id,
      },
    },
    create: {
      userId: session.user.id,
      unitRequestId: request.id,
    },
    update: { readAt: new Date() },
  });

  if (!parsed.data.skipRevalidate) {
    revalidatePath("/operations/requests");
  }
  return actionOk();
}

async function loadFulfillmentContext(itemId: string) {
  return prisma.archiveFileRequestItem.findUnique({
    where: { id: itemId },
    include: {
      unitRequest: {
        include: {
          unit: {
            include: {
              client: true,
              contractWorkflow: true,
              project: { select: { name: true } },
            },
          },
          requestedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
}

async function assertOperationsFulfillment(
  item: NonNullable<Awaited<ReturnType<typeof loadFulfillmentContext>>>
): Promise<ActionResult | null> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  if (
    !operationsMayFulfillArchiveFileRequest({
      role: session.user.role,
      status: item.unitRequest.status,
      type: item.unitRequest.type,
      currentApproverKind: item.unitRequest.currentApproverKind,
    })
  ) {
    return actionFail("Unauthorized");
  }

  if (item.status !== "PENDING") {
    return actionFail("This file was already handled");
  }

  if (!item.unitRequest.unitId || !item.unitRequest.unit) {
    return actionFail("Unit not found");
  }

  return null;
}

async function uploadUnitDocumentForArchiveFile(input: {
  unitId: string;
  documentType: UnitDocumentKind;
  file: File;
}): Promise<{ storedName: string } | { error: string }> {
  const unit = await prisma.unit.findUnique({
    where: { id: input.unitId },
    include: { contractWorkflow: true, finishing: true },
  });
  if (!unit) return { error: "Unit not found" };

  const previous =
    input.documentType === "signedContract"
      ? unit.contractWorkflow?.signedContractFile
      : input.documentType === "extensionAnnex"
        ? unit.contractWorkflow?.extensionAnnexFile
        : unit.finishing?.finishingContractFile;

  if (previous) {
    return { error: "A file is already on record for this unit (upload only — no replace)" };
  }

  const storedName = buildUnitDocumentStoredFilename(input.unitId, input.file.name);
  await writeUnitDocumentFile(input.documentType, storedName, input.file);

  if (input.documentType === "finishingContract") {
    await prisma.finishing.upsert({
      where: { unitId: input.unitId },
      create: { unitId: input.unitId, finishingContractFile: storedName },
      update: { finishingContractFile: storedName },
    });
  } else {
    const patch =
      input.documentType === "signedContract"
        ? {
            signedContractFile: storedName,
            ...(!unit.contractWorkflow?.hasPreliminarySaleContract
              ? { hasPreliminarySaleContract: true }
              : {}),
          }
        : {
            extensionAnnexFile: storedName,
            ...(!unit.contractWorkflow?.hasSignedExtension
              ? { hasSignedExtension: true }
              : {}),
          };

    await prisma.contractWorkflow.upsert({
      where: { unitId: input.unitId },
      create: { unitId: input.unitId, ...patch },
      update: patch,
    });
  }

  return { storedName };
}

export async function fulfillArchiveFileItemUploadAction(
  formData: FormData
): Promise<ActionResult> {
  const itemId = String(formData.get("itemId") ?? "");
  const file = formData.get("file");
  if (!itemId) return actionFail("Invalid input");
  if (!(file instanceof File)) return actionFail("No file provided");

  const item = await loadFulfillmentContext(itemId);
  if (!item) return actionFail("Item not found");

  const gate = await assertOperationsFulfillment(item);
  if (gate) return gate;

  const session = await auth();
  const unit = item.unitRequest.unit!;
  const unitId = unit.id;
  const requestId = item.unitRequest.id;

  if (file.size === 0) return actionFail("File is empty");

  const mapped = archiveFileKindToUnitDocumentKind(item.fileKind);

  return withAudit(async () => {
    let attachmentId: string | null = null;

    if (mapped === "nationalId") {
      if (!unit.clientId || !unit.client) {
        return actionFail("Unit has no client profile for ID upload");
      }
      if (unit.client.nationalIdFile) {
        return actionFail("ID scan already on file (upload only — no replace)");
      }
      if (file.size > NATIONAL_ID_MAX_BYTES) {
        return actionFail("File exceeds size limit");
      }
      if (!isAllowedNationalIdMime(file.type)) {
        return actionFail("File type not allowed");
      }
      const storedName = buildNationalIdStoredFilename(unit.clientId, file.name);
      await writeNationalIdFile(storedName, file);
      await prisma.client.update({
        where: { id: unit.clientId },
        data: { nationalIdFile: storedName },
      });
    } else if (mapped) {
      if (file.size > UNIT_DOCUMENT_MAX_BYTES) {
        return actionFail("File exceeds size limit");
      }
      if (!isAllowedUnitDocumentMime(file.type)) {
        return actionFail("File type not allowed");
      }
      const uploaded = await uploadUnitDocumentForArchiveFile({
        unitId,
        documentType: mapped,
        file,
      });
      if ("error" in uploaded) return actionFail(uploaded.error);
    } else {
      if (file.size > REQUEST_ATTACHMENT_MAX_BYTES) {
        return actionFail("File exceeds size limit");
      }
      if (!isAllowedRequestAttachmentMime(file.type)) {
        return actionFail("File type not allowed");
      }
      const storedName = buildRequestAttachmentStoredFilename(requestId, file.name);
      const bytes = Buffer.from(await file.arrayBuffer());
      await writeRequestAttachmentFile(storedName, bytes);
      const attachment = await prisma.requestAttachment.create({
        data: {
          requestId,
          storedName,
          originalName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          uploadedById: session!.user!.id,
        },
      });
      attachmentId = attachment.id;
    }

    const now = new Date();
    await prisma.archiveFileRequestItem.update({
      where: { id: item.id },
      data: {
        status: "FULFILLED_UPLOAD",
        fulfilledAt: now,
        fulfilledById: session!.user!.id,
        resultAttachmentId: attachmentId,
      },
    });

    await recordRequestAuditEvent({
      requestId,
      userId: session!.user!.id,
      action: "archive_file_uploaded",
      details: { itemId: item.id, fileKind: item.fileKind },
    });

    const ctx = auditContext.getStore();
    if (ctx?.userId) {
      await recordAuditLog(basePrisma, ctx, {
        model: "UnitRequest",
        action: "UPDATE",
        recordId: requestId,
        newData: {
          operation: "archive_file_uploaded",
          fileKind: item.fileKind,
          unitId,
        },
      });
    }

    await notifyRequesterArchiveFileItemOutcome({
      requesterId: item.unitRequest.requestedById,
      unitId,
      unitCode: unit.unitCode,
      requestId,
      fileKind: item.fileKind,
      status: "FULFILLED_UPLOAD",
      attachmentId,
    });

    await tryCompleteArchiveFileRequest({
      prisma,
      unitRequestId: requestId,
      resolvedById: session!.user!.id,
    });

    revalidatePath(`/operations/requests/${requestId}`);
    revalidatePath("/operations/requests");
    revalidatePath(`/units/${unitId}`);
    revalidatePath(`/requests/${requestId}`);
    return actionOk();
  });
}

export async function markArchiveFileItemNotFoundAction(
  input: z.input<typeof notFoundSchema>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const parsed = notFoundSchema.safeParse(input);
  if (!parsed.success) return actionFail("Invalid input");

  const item = await loadFulfillmentContext(parsed.data.itemId);
  if (!item) return actionFail("Item not found");

  const gate = await assertOperationsFulfillment(item);
  if (gate) return gate;

  const unit = item.unitRequest.unit;
  if (!unit) return actionFail("Unit not found");

  const now = new Date();
  await prisma.archiveFileRequestItem.update({
    where: { id: item.id },
    data: {
      status: "NOT_FOUND",
      notFoundNote: parsed.data.note.trim(),
      fulfilledAt: now,
      fulfilledById: session.user.id,
    },
  });

  await recordRequestAuditEvent({
    requestId: item.unitRequest.id,
    userId: session.user.id,
    action: "archive_file_not_found",
    details: { itemId: item.id, fileKind: item.fileKind, note: parsed.data.note.trim() },
  });

  await notifyRequesterArchiveFileItemOutcome({
    requesterId: item.unitRequest.requestedById,
    unitId: unit.id,
    unitCode: unit.unitCode,
    requestId: item.unitRequest.id,
    fileKind: item.fileKind,
    status: "NOT_FOUND",
  });

  await tryCompleteArchiveFileRequest({
    prisma,
    unitRequestId: item.unitRequest.id,
    resolvedById: session.user.id,
  });

  revalidatePath(`/operations/requests/${item.unitRequest.id}`);
  revalidatePath("/operations/requests");
  return actionOk();
}

export async function getArchiveFileRequestDetailForOperationsAction(
  requestId: string
) {
  const session = await auth();
  if (!session?.user || !canAccessOperationsArchiveFileInbox(session.user.role)) {
    return null;
  }

  return loadArchiveFileRequestDetail(requestId);
}
