import type { ArchiveFileItemStatus, UnitRequestStatus } from "@prisma/client";

import { prisma as appPrisma } from "@/lib/prisma";
import { recordRequestAuditEvent } from "@/lib/requests/audit";
import { encodeBilingual } from "@/lib/notifications/bilingual";
import { createNotification } from "@/lib/notifications/create-notification";
import { fulfillmentLinkForArchiveFileItem } from "@/lib/archive-file-request/links";

export type ArchiveFileRequestDb = typeof appPrisma;

export async function allArchiveFileItemsResolved(
  prisma: ArchiveFileRequestDb,
  unitRequestId: string
): Promise<boolean> {
  const pending = await prisma.archiveFileRequestItem.count({
    where: { unitRequestId, status: "PENDING" },
  });
  return pending === 0;
}

export async function tryCompleteArchiveFileRequest(input: {
  prisma: ArchiveFileRequestDb;
  unitRequestId: string;
  resolvedById: string;
  now?: Date;
}): Promise<boolean> {
  const done = await allArchiveFileItemsResolved(input.prisma, input.unitRequestId);
  if (!done) return false;

  const now = input.now ?? new Date();
  await input.prisma.unitRequest.update({
    where: { id: input.unitRequestId },
    data: {
      status: "APPROVED",
      resolvedAt: now,
      resolvedById: input.resolvedById,
      currentApproverKind: null,
    },
  });

  await recordRequestAuditEvent({
    requestId: input.unitRequestId,
    userId: input.resolvedById,
    action: "archive_file_request_completed",
  });

  return true;
}

export async function notifyRequesterArchiveFileItemOutcome(input: {
  requesterId: string;
  unitId: string;
  unitCode: string;
  requestId: string;
  fileKind: import("@prisma/client").ArchiveFileKind;
  status: ArchiveFileItemStatus;
  attachmentId?: string | null;
}) {
  const link =
    input.status === "FULFILLED_UPLOAD"
      ? fulfillmentLinkForArchiveFileItem({
          unitId: input.unitId,
          requestId: input.requestId,
          fileKind: input.fileKind,
          attachmentId: input.attachmentId,
        })
      : `/requests/${input.requestId}`;

  const titleEn =
    input.status === "FULFILLED_UPLOAD"
      ? "Archive file ready"
      : "Archive file not found";
  const titleAr =
    input.status === "FULFILLED_UPLOAD"
      ? "ملف الأرشيف جاهز"
      : "الملف غير موجود في الأرشيف";

  const kindLabelEn = input.fileKind.replace(/_/g, " ").toLowerCase();
  const messageEn =
    input.status === "FULFILLED_UPLOAD"
      ? `Operations uploaded ${kindLabelEn} for unit ${input.unitCode}.`
      : `Operations could not locate ${kindLabelEn} for unit ${input.unitCode} in the archive.`;

  const messageAr =
    input.status === "FULFILLED_UPLOAD"
      ? `رفعت العمليات ملف ${input.fileKind} للوحدة ${input.unitCode}.`
      : `تعذر على العمليات العثور على ${input.fileKind} للوحدة ${input.unitCode} في الأرشيف.`;

  await createNotification({
    userId: input.requesterId,
    title: encodeBilingual(titleEn, titleAr),
    message: encodeBilingual(messageEn, messageAr),
    link,
  });
}

export function isOpenArchiveFileRequestStatus(status: UnitRequestStatus): boolean {
  return status === "DRAFT" || status === "PENDING";
}
