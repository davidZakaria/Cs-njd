import { callLogNotesSnippetForInbox } from "@/lib/calls/call-log-notes";
import { parseCallLogTicketId } from "@/lib/notifications/call-log-dedupe";
import type { CallLogInboxDisplay } from "@/lib/notifications/call-log-inbox-display-types";
import { basePrisma } from "@/lib/prisma";

export async function attachCallLogDisplayToItems(
  rows: Array<{ id: string; dedupeKey: string | null }>
): Promise<Map<string, CallLogInboxDisplay>> {
  const result = new Map<string, CallLogInboxDisplay>();
  const ticketIds: string[] = [];
  const idsByTicket = new Map<string, string[]>();

  for (const row of rows) {
    const ticketId = parseCallLogTicketId(row.dedupeKey);
    if (!ticketId) continue;
    ticketIds.push(ticketId);
    const list = idsByTicket.get(ticketId) ?? [];
    list.push(row.id);
    idsByTicket.set(ticketId, list);
  }

  if (ticketIds.length === 0) return result;

  const tickets = await basePrisma.ticket.findMany({
    where: { id: { in: ticketIds } },
    select: {
      id: true,
      notes: true,
      createdBy: { select: { name: true, email: true } },
      unit: {
        select: {
          unitCode: true,
          client: { select: { name: true } },
          project: { select: { name: true } },
        },
      },
    },
  });

  for (const ticket of tickets) {
    const loggerName =
      ticket.createdBy?.name?.trim() ||
      ticket.createdBy?.email?.trim() ||
      "—";
    const display: CallLogInboxDisplay = {
      unitCode: ticket.unit.unitCode,
      projectName: ticket.unit.project.name,
      clientName: ticket.unit.client?.name?.trim() || "—",
      loggerName,
      notesSnippet: callLogNotesSnippetForInbox(ticket.notes),
    };
    for (const inboxId of idsByTicket.get(ticket.id) ?? []) {
      result.set(inboxId, display);
    }
  }

  return result;
}