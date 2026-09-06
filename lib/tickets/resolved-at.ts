import type { TicketStatus } from "@prisma/client";

export function resolvedAtForStatusChange(
  previousStatus: TicketStatus,
  nextStatus: TicketStatus
): Date | null | undefined {
  if (nextStatus === "RESOLVED") {
    return new Date();
  }
  if (previousStatus === "RESOLVED") {
    return null;
  }
  return undefined;
}
