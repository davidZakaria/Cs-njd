import type { TicketStatus } from "@prisma/client";

import { OPEN_TICKET_STATUSES } from "@/lib/cases/workflow";

export type TimelineTicketLike = {
  id: string;
  notes: string;
  category: string;
  status?: TicketStatus | string;
  createdAt: Date | string;
  unitId?: string;
  agentId?: string | null;
};

/** Window for collapsing duplicate history/import rows (same note, category, author). */
export const TIMELINE_HISTORY_DEDUPE_WINDOW_MS = 15 * 60 * 1000;

/** Collapse whitespace for stable comparison (import / Excel noise). */
export function normalizeTimelineNoteKey(notes: string): string {
  return notes.replace(/\s+/g, " ").trim().toLowerCase();
}

function ticketCreatedAtMs(ticket: TimelineTicketLike): number {
  const value =
    ticket.createdAt instanceof Date
      ? ticket.createdAt.getTime()
      : new Date(ticket.createdAt).getTime();
  return Number.isNaN(value) ? 0 : value;
}

/** Open / actionable rows must always render (CS controls, case lists, counts). */
export function isTimelineProtectedTicket(ticket: TimelineTicketLike): boolean {
  if (ticket.status == null || ticket.status === "") {
    return true;
  }
  return OPEN_TICKET_STATUSES.includes(ticket.status as TicketStatus);
}

export function isTimelineHistoryReadOnly(ticket: TimelineTicketLike): boolean {
  if (isTimelineProtectedTicket(ticket)) return false;
  return ticket.category === "FEEDBACK_HISTORY" || ticket.status === "RESOLVED";
}

function historyDedupeKey(ticket: TimelineTicketLike, noteKey: string): string {
  return `${ticket.unitId ?? ""}::${ticket.category}::${noteKey}::${ticket.agentId ?? ""}`;
}

/**
 * Timeline + cases list dedupe:
 * - Never drop protected (open) tickets.
 * - Drop history rows whose note matches an open ticket on the same unit.
 * - Among read-only/history rows only, collapse duplicates (type+note+author) in a short window.
 * Input order should be `createdAt desc` (newest first) for stable picks among history dupes.
 */
export function dedupeTimelineTickets<T extends TimelineTicketLike>(
  tickets: T[]
): T[] {
  const openNoteKeysByUnit = new Map<string, Set<string>>();

  for (const ticket of tickets) {
    if (!isTimelineProtectedTicket(ticket)) continue;
    const noteKey = normalizeTimelineNoteKey(ticket.notes);
    if (!noteKey) continue;
    const unitKey = ticket.unitId ?? "";
    const set = openNoteKeysByUnit.get(unitKey) ?? new Set<string>();
    set.add(noteKey);
    openNoteKeysByUnit.set(unitKey, set);
  }

  const historyKeeps: Array<{ compositeKey: string; at: number }> = [];
  const result: T[] = [];

  for (const ticket of tickets) {
    if (isTimelineProtectedTicket(ticket)) {
      result.push(ticket);
      continue;
    }

    if (!isTimelineHistoryReadOnly(ticket)) {
      result.push(ticket);
      continue;
    }

    const noteKey = normalizeTimelineNoteKey(ticket.notes);
    const unitKey = ticket.unitId ?? "";

    if (noteKey && openNoteKeysByUnit.get(unitKey)?.has(noteKey)) {
      continue;
    }

    if (!noteKey) {
      result.push(ticket);
      continue;
    }

    const compositeKey = historyDedupeKey(ticket, noteKey);
    const at = ticketCreatedAtMs(ticket);
    const duplicateHistory = historyKeeps.some(
      (keeper) =>
        keeper.compositeKey === compositeKey &&
        Math.abs(keeper.at - at) <= TIMELINE_HISTORY_DEDUPE_WINDOW_MS
    );
    if (duplicateHistory) continue;

    historyKeeps.push({ compositeKey, at });
    result.push(ticket);
  }

  return result;
}