import type { TicketCategory, TicketStatus } from "@prisma/client";
import { isAwaitingResponseNote } from "@/lib/import/master-cases";

export const OPEN_TICKET_STATUSES: TicketStatus[] = [
  "PENDING",
  "ENGINEERING",
  "LEGAL",
];

export type CaseWorkflowKey =
  | "customerServiceAwaiting"
  | "customerServiceActive"
  | "legalOpen"
  | "engineeringOpen"
  | "generalOpen";

export function getCaseWorkflowKey(
  category: TicketCategory,
  status: TicketStatus,
  notes: string
): CaseWorkflowKey {
  if (category === "LEGAL" || status === "LEGAL") return "legalOpen";
  if (status === "ENGINEERING") return "engineeringOpen";
  if (category === "CUSTOMER_SERVICE" && isAwaitingResponseNote(notes)) {
    return "customerServiceAwaiting";
  }
  if (category === "CUSTOMER_SERVICE") return "customerServiceActive";
  return "generalOpen";
}

/** Primary open ticket to highlight when a unit has several open cases. */
export function pickPrimaryOpenTicket<
  T extends { category: TicketCategory; status: TicketStatus; notes: string }
>(tickets: T[]): T {
  const rank = (ticket: T) => {
    if (ticket.category === "LEGAL" || ticket.status === "LEGAL") return 0;
    if (ticket.category === "CUSTOMER_SERVICE" && isAwaitingResponseNote(ticket.notes)) {
      return 1;
    }
    if (ticket.status === "ENGINEERING") return 2;
    if (ticket.category === "CUSTOMER_SERVICE") return 3;
    return 4;
  };

  return [...tickets].sort((a, b) => rank(a) - rank(b))[0];
}
