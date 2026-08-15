import type { TicketCategory, TicketStatus } from "@prisma/client";

export const AWAITING_RESPONSE_NOTE =
  "Awaiting response — no current customer service feedback recorded.";

export type ImportCase = {
  notes: string;
  category: TicketCategory;
  status?: TicketStatus;
};

/** Categories where import keeps one canonical case per unit (updated on re-import). */
export const CANONICAL_CASE_CATEGORIES: ReadonlySet<TicketCategory> = new Set([
  "CUSTOMER_SERVICE",
  "FEEDBACK_HISTORY",
  "LEGAL",
]);

/**
 * NJD 2026 master sheet:
 * - Col 14 (custmer service) = current status / active feedback
 * - Col 15 (FEEDBACK OLD)    = historical feedback
 * - Col 16 (Legal)           = legal notes
 * Empty col 14 means the unit is awaiting a current response.
 */
export function buildMasterSheetCases(
  customerServiceRaw: unknown,
  feedbackOldRaw: unknown,
  legalRaw: unknown
): ImportCase[] {
  const customerService = String(customerServiceRaw ?? "").trim();
  const feedbackOld = String(feedbackOldRaw ?? "").trim();
  const legal = String(legalRaw ?? "").trim();

  const cases: ImportCase[] = [
    {
      notes: customerService || AWAITING_RESPONSE_NOTE,
      category: "CUSTOMER_SERVICE",
      status: "PENDING",
    },
  ];

  if (feedbackOld) {
    cases.push({
      notes: feedbackOld,
      category: "FEEDBACK_HISTORY",
      status: "RESOLVED",
    });
  }

  if (legal) {
    cases.push({
      notes: legal,
      category: "LEGAL",
      status: "LEGAL",
    });
  }

  return cases;
}

export function isAwaitingResponseNote(notes: string): boolean {
  return notes.trim() === AWAITING_RESPONSE_NOTE;
}
