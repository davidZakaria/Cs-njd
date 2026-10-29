import "server-only";

import type { Role } from "@prisma/client";

import type { CsAgentScope } from "@/lib/auth/cs-agent-scope";
import { filterRequestRowsByView } from "@/lib/requests/permissions-core";
import type { RequestsPageFilters, UnitRequestListRow } from "@/lib/requests/types";
import { isRequestOverdue } from "@/lib/requests/overdue";

export type { UnitRequestListRow, RequestsPageFilters, OverdueUnitRequestRow } from "@/lib/requests/types";

export { isRequestOverdue } from "@/lib/requests/overdue";

export function filterRequestRowsForUser(input: {
  rows: UnitRequestListRow[];
  role: Role;
  userId: string;
  csScope?: CsAgentScope | null;
  filters: RequestsPageFilters;
  now?: Date;
}): UnitRequestListRow[] {
  return filterRequestRowsByView({
    rows: input.rows,
    role: input.role,
    userId: input.userId,
    filters: input.filters,
    now: input.now,
  });
}

export function toOverdueRow(
  row: UnitRequestListRow,
  now: Date = new Date()
): (UnitRequestListRow & { daysOverdue: number }) | null {
  if (!isRequestOverdue({ status: row.status, dueDate: row.dueDate, now })) {
    return null;
  }
  const daysOverdue = Math.max(
    1,
    Math.floor((now.getTime() - (row.dueDate?.getTime() ?? now.getTime())) / 86400000)
  );
  return { ...row, daysOverdue };
}
