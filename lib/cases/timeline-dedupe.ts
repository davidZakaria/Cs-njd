export type TimelineTicketLike = {
  id: string;
  notes: string;
  category: string;
  createdAt: Date | string;
  unitId?: string;
};

/** Collapse whitespace for stable comparison (import / Excel noise). */
export function normalizeTimelineNoteKey(notes: string): string {
  return notes.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Hide duplicate timeline rows on read (same note body). Keeps the newest ticket
 * (list should already be sorted `createdAt desc`).
 */
export function dedupeTimelineTickets<T extends TimelineTicketLike>(
  tickets: T[]
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const ticket of tickets) {
    const key = `${ticket.unitId ?? ""}::${normalizeTimelineNoteKey(ticket.notes)}`;
    if (!key) {
      result.push(ticket);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ticket);
  }

  return result;
}