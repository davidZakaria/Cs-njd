import type { ArchiveFileRequestPriority, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const inboxInclude = {
  unit: {
    select: {
      id: true,
      unitCode: true,
      project: { select: { name: true } },
    },
  },
  requestedBy: { select: { id: true, name: true } },
  archiveFileItems: { orderBy: { createdAt: "asc" as const } },
  operationsArchiveFileReads: { select: { userId: true } },
} as const;

export type OperationsArchiveFileInboxRow = Prisma.UnitRequestGetPayload<{
  include: typeof inboxInclude;
}>;

export async function loadOperationsArchiveFileInbox(userId: string) {
  const rows = await prisma.unitRequest.findMany({
    where: {
      type: "ARCHIVE_FILE_REQUEST",
      status: "PENDING",
      currentApproverKind: "OPERATIONS",
    },
    include: inboxInclude,
    orderBy: [{ archiveFilePriority: "desc" }, { submittedAt: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((row) => ({
    ...row,
    isUnread: !row.operationsArchiveFileReads.some((r) => r.userId === userId),
  }));
}

export async function countUnreadOperationsArchiveFileInbox(
  userId: string
): Promise<number> {
  return prisma.unitRequest.count({
    where: {
      type: "ARCHIVE_FILE_REQUEST",
      status: "PENDING",
      currentApproverKind: "OPERATIONS",
      operationsArchiveFileReads: { none: { userId } },
    },
  });
}

export function sortInboxRowsForDisplay<
  T extends {
    archiveFilePriority: ArchiveFileRequestPriority | null;
    submittedAt: Date | null;
    createdAt: Date;
  },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aUrgent = a.archiveFilePriority === "URGENT" ? 1 : 0;
    const bUrgent = b.archiveFilePriority === "URGENT" ? 1 : 0;
    if (bUrgent !== aUrgent) return bUrgent - aUrgent;
    const aTime = (a.submittedAt ?? a.createdAt).getTime();
    const bTime = (b.submittedAt ?? b.createdAt).getTime();
    return bTime - aTime;
  });
}

export async function loadArchiveFileRequestDetail(requestId: string) {
  return prisma.unitRequest.findFirst({
    where: { id: requestId, type: "ARCHIVE_FILE_REQUEST" },
    include: {
      unit: {
        select: {
          id: true,
          unitCode: true,
          clientId: true,
          project: { select: { name: true } },
          contractWorkflow: true,
          client: { select: { nationalIdFile: true } },
        },
      },
      requestedBy: { select: { id: true, name: true } },
      archiveFileItems: { orderBy: { createdAt: "asc" } },
    },
  });
}
