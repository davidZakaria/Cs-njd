import type { Role } from "@prisma/client";

import { prisma as appPrisma } from "@/lib/prisma";
import { activeUnitWhere } from "@/lib/prisma/soft-delete";
import { operationsMayWorkArchiveCheckRequest } from "@/lib/archive-check/permissions";

export type ArchiveCheckQueueRow = {
  id: string;
  unitId: string;
  unitCode: string;
  projectName: string;
  clientName: string;
  dueDate: string | null;
  requestedByName: string;
  parentRequestId: string | null;
  itemCount: number;
  pendingItemCount: number;
};

const unitIncludeForArchiveSeed = {
  project: { select: { name: true } },
  client: { select: { name: true, nationalIdFile: true } },
  unitClients: {
    select: {
      role: true,
      position: true,
      client: { select: { nationalIdFile: true } },
    },
  },
  contractWorkflow: true,
  finishing: true,
} as const;

export { unitIncludeForArchiveSeed };

export async function loadOperationsArchiveCheckQueue(input: {
  role: Role;
  limit?: number;
}): Promise<ArchiveCheckQueueRow[]> {
  if (input.role !== "OPERATIONS" && input.role !== "SUPER_ADMIN") {
    return [];
  }

  const rows = await appPrisma.unitRequest.findMany({
    where: {
      type: "ARCHIVE_CHECK",
      status: "PENDING",
      currentApproverKind: "OPERATIONS",
      archiveCheckSubmittedAt: null,
      bulkProjectId: null,
      unitId: { not: null },
    },
    include: {
      requestedBy: { select: { name: true } },
      unit: {
        select: {
          id: true,
          unitCode: true,
          client: { select: { name: true } },
          project: { select: { name: true } },
        },
      },
      archiveCheckItems: { select: { id: true, status: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    take: input.limit ?? 100,
  });

  return rows
    .filter((row) => row.unit != null)
    .filter((row) =>
      operationsMayWorkArchiveCheckRequest(input.role, {
        type: row.type,
        status: row.status,
        currentApproverKind: row.currentApproverKind,
        archiveCheckSubmittedAt: row.archiveCheckSubmittedAt,
        parentRequestId: row.parentRequestId,
        bulkProjectId: row.bulkProjectId,
      })
    )
    .map((row) => ({
      id: row.id,
      unitId: row.unit!.id,
      unitCode: row.unit!.unitCode,
      projectName: row.unit!.project.name,
      clientName: row.unit!.client?.name ?? "—",
      dueDate: row.dueDate?.toISOString() ?? null,
      requestedByName: row.requestedBy.name,
      parentRequestId: row.parentRequestId,
      itemCount: row.archiveCheckItems.length,
      pendingItemCount: row.archiveCheckItems.filter(
        (item) => item.status === "PENDING"
      ).length,
    }));
}

export async function loadOpenArchiveGapTasksForUnit(unitId: string) {
  return appPrisma.archiveCheckGapTask.findMany({
    where: {
      status: "OPEN",
      unitRequest: { unitId, status: "PENDING" },
    },
    select: {
      id: true,
      unitRequestId: true,
      itemKey: true,
      unitCycleStageKey: true,
    },
  });
}

export async function loadArchiveCheckDetail(requestId: string) {
  return appPrisma.unitRequest.findUnique({
    where: { id: requestId },
    include: {
      unit: {
        include: unitIncludeForArchiveSeed,
      },
      requestedBy: { select: { id: true, name: true } },
      childRequests: {
        include: {
          unit: {
            select: {
              id: true,
              unitCode: true,
              project: { select: { name: true } },
              client: { select: { name: true } },
            },
          },
          archiveCheckItems: true,
          archiveCheckGapTasks: true,
        },
        orderBy: { unit: { unitCode: "asc" } },
      },
      archiveCheckItems: { orderBy: { itemKey: "asc" } },
      archiveCheckGapTasks: { orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
      bulkProject: { select: { id: true, name: true } },
    },
  });
}

export async function listActiveUnitsForProject(projectId: string) {
  return appPrisma.unit.findMany({
    where: activeUnitWhere({ projectId }),
    select: { id: true, clientId: true },
    orderBy: { unitCode: "asc" },
  });
}

export async function loadDepartmentArchiveGapTasks(input: {
  role: import("@prisma/client").Role;
  limit?: number;
}) {
  const roles =
    input.role === "LEGAL"
      ? (["LEGAL", "MANAGEMENT"] as const)
      : input.role === "FINANCE"
        ? (["FINANCE", "MANAGEMENT"] as const)
        : input.role === "MANAGEMENT" || input.role === "SUPER_ADMIN"
          ? (["LEGAL", "FINANCE", "MANAGEMENT"] as const)
          : ([] as const);

  if (roles.length === 0) return [];

  return appPrisma.archiveCheckGapTask.findMany({
    where: {
      status: "OPEN",
      ownerRole: { in: [...roles] },
    },
    include: {
      unitRequest: {
        include: {
          unit: {
            select: {
              id: true,
              unitCode: true,
              project: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ deadlineAt: "asc" }],
    take: input.limit ?? 50,
  });
}
