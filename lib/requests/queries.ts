import type { Role, UnitRequestStatus, UnitRequestType } from "@prisma/client";

import type { CsAgentScope } from "@/lib/auth/cs-agent-scope";
import { isAdminUnitManager, isCommunityManagementRole } from "@/lib/auth/unit-roles";
import { requestMatchesRoleInbox } from "@/lib/requests/permissions";

export type UnitRequestListRow = {
  id: string;
  type: UnitRequestType;
  status: UnitRequestStatus;
  dueDate: Date | null;
  submittedAt: Date | null;
  currentApproverKind: import("@prisma/client").UnitRequestApproverKind | null;
  escalatedToManagement: boolean;
  requestedById: string;
  requestedByName: string;
  unitId: string;
  unitCode: string;
  projectName: string;
  clientName: string;
  unitAgentId: string | null;
  unitCycleStageKey: import("@prisma/client").UnitCycleStageKey | null;
};

export type RequestsPageFilters = {
  view: "awaiting" | "submitted" | "all";
  status: "all" | UnitRequestStatus;
  type: "all" | UnitRequestType;
  project: string;
  overdue: "all" | "yes";
};

export function filterRequestRowsForUser(input: {
  rows: UnitRequestListRow[];
  role: Role;
  userId: string;
  csScope?: CsAgentScope | null;
  filters: RequestsPageFilters;
  now?: Date;
}): UnitRequestListRow[] {
  const now = input.now ?? new Date();
  let list = input.rows;

  if (isCommunityManagementRole(input.role)) {
    list = list.filter((row) => row.type === "HANDOVER_APPOINTMENT");
  }

  if (input.filters.view === "awaiting") {
    list = list.filter((row) =>
      requestMatchesRoleInbox({
        role: input.role,
        userId: input.userId,
        type: row.type,
        status: row.status,
        currentApproverKind: row.currentApproverKind,
        requestedById: row.requestedById,
        unitAgentId: row.unitAgentId,
        csScope: input.csScope,
        view: "awaiting",
      })
    );
  } else if (input.filters.view === "submitted") {
    list = list.filter((row) => row.requestedById === input.userId);
  } else if (!isAdminUnitManager(input.role) && input.role !== "SUPER_ADMIN") {
    list = list.filter(
      (row) =>
        row.requestedById === input.userId ||
        requestMatchesRoleInbox({
          role: input.role,
          userId: input.userId,
          type: row.type,
          status: row.status,
          currentApproverKind: row.currentApproverKind,
          requestedById: row.requestedById,
          unitAgentId: row.unitAgentId,
          csScope: input.csScope,
          view: "awaiting",
        }) ||
        (isCommunityManagementRole(input.role) && row.type === "HANDOVER_APPOINTMENT")
    );
  }

  if (input.filters.status !== "all") {
    list = list.filter((row) => row.status === input.filters.status);
  }
  if (input.filters.type !== "all") {
    list = list.filter((row) => row.type === input.filters.type);
  }
  if (input.filters.project !== "all") {
    list = list.filter((row) => row.projectName === input.filters.project);
  }
  if (input.filters.overdue === "yes") {
    list = list.filter(
      (row) =>
        row.status === "PENDING" &&
        row.dueDate != null &&
        row.dueDate.getTime() < now.getTime()
    );
  }

  return list;
}

export function isRequestOverdue(input: {
  status: UnitRequestStatus;
  dueDate: Date | null;
  now?: Date;
}): boolean {
  if (input.status !== "PENDING" || !input.dueDate) return false;
  const now = input.now ?? new Date();
  return input.dueDate.getTime() < now.getTime();
}

export type OverdueUnitRequestRow = UnitRequestListRow & { daysOverdue: number };

export function toOverdueRow(
  row: UnitRequestListRow,
  now: Date = new Date()
): OverdueUnitRequestRow | null {
  if (!isRequestOverdue({ status: row.status, dueDate: row.dueDate, now })) {
    return null;
  }
  const daysOverdue = Math.max(
    1,
    Math.floor((now.getTime() - (row.dueDate?.getTime() ?? now.getTime())) / 86400000)
  );
  return { ...row, daysOverdue };
}
