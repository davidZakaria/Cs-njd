import type { UnitRequestStatus } from "@prisma/client";

/** Client-safe overdue check (no server imports). */
export function isRequestOverdue(input: {
  status: UnitRequestStatus;
  dueDate: Date | null | string;
  now?: Date;
}): boolean {
  if (input.status !== "PENDING" || input.dueDate == null) return false;
  const due =
    input.dueDate instanceof Date ? input.dueDate : new Date(input.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const now = input.now ?? new Date();
  return due.getTime() < now.getTime();
}
