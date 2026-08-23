import type { TicketCategory, TicketStatus } from "@prisma/client";
import { normalizeMatchText } from "@/lib/import/fuzzy-match";

export const AWAITING_RESPONSE_NOTE =
  "Awaiting response — no current customer service feedback recorded.";

export const DELIVERY_PROTOCOL_SIGNED_NOTE =
  "Delivery protocol signed — no open customer service issues recorded.";

export type ImportCase = {
  notes: string;
  category: TicketCategory;
  status?: TicketStatus;
};

export type MasterSheetCaseInput = {
  handoverRaw?: unknown;
  actionRaw?: unknown;
  customerServiceRaw?: unknown;
  feedbackOldRaw?: unknown;
  legalRaw?: unknown;
  warningsRaw?: unknown;
  engineeringRaw?: unknown;
};

/** Categories where import keeps one canonical case per unit (updated on re-import). */
export const CANONICAL_CASE_CATEGORIES: ReadonlySet<TicketCategory> = new Set([
  "CUSTOMER_SERVICE",
  "FEEDBACK_HISTORY",
  "LEGAL",
]);

const OPEN_ISSUE_PATTERNS = [
  "في انتظار",
  "فى انتظار",
  "منتظر",
  "awaiting",
  "waiting",
  "رافض",
  "لم يتم",
  "جاري",
  "اتخاذ الازم",
  "اتخاذ اللازم",
  "مش عاوز",
  "طلب تأجيل",
  "مراجعه",
  "بيتم",
  "حاليا",
  "in progress",
  "pending",
];

/**
 * NJD 2026 master sheet (0-based column indices):
 * - Col 8  (محضر استلام)   = handover / delivery protocol status
 * - Col 13 (ACTION)        = current action label
 * - Col 14 (RESPONSIBL)    = assigned CS agent (not a case note)
 * - Col 15 (custmer service) = current status / active feedback
 * - Col 16 (FEEDBACK OLD)  = historical feedback
 * - Col 21 (القانونيه)     = legal notes
 * - Col 22 (اعذارات)       = warnings
 * - Col 24 (الهندسيه)      = engineering notes
 */
export function isDeliveryProtocolSigned(handoverRaw: unknown): boolean {
  const text = normalizeMatchText(String(handoverRaw ?? ""));
  if (!text) return false;
  return (
    text.includes(normalizeMatchText("تم توقيع محضر استلام")) ||
    text.startsWith(normalizeMatchText("توقيع محضر استلام"))
  );
}

function trimField(raw: unknown) {
  return String(raw ?? "").trim();
}

function isEchoOrAgentLabel(text: string, handover: string) {
  const normalized = normalizeMatchText(text);
  if (!normalized || normalized === "/") return true;

  const handoverNorm = normalizeMatchText(handover);
  if (handoverNorm && normalized === handoverNorm) return true;

  // Agent names and short routing labels rarely exceed this without issue keywords.
  if (normalized.length <= 24 && !containsOpenIssueKeyword(normalized)) {
    return !normalized.includes(normalizeMatchText("قانون"));
  }

  return false;
}

function containsOpenIssueKeyword(normalizedText: string) {
  return OPEN_ISSUE_PATTERNS.some((pattern) =>
    normalizedText.includes(normalizeMatchText(pattern))
  );
}

export function hasOpenIssueFromComments(input: {
  handover?: string;
  action?: string;
  customerService?: string;
  warnings?: string;
}): boolean {
  const handover = input.handover ?? "";
  const fields = [input.action, input.customerService, input.warnings];

  for (const field of fields) {
    const text = trimField(field);
    if (!text || isEchoOrAgentLabel(text, handover)) continue;
    if (containsOpenIssueKeyword(normalizeMatchText(text))) return true;
  }

  return false;
}

function deriveCustomerServiceStatus(input: MasterSheetCaseInput): TicketStatus {
  const legal = trimField(input.legalRaw);
  const engineering = trimField(input.engineeringRaw);
  const handover = trimField(input.handoverRaw);

  if (legal) return "LEGAL";
  if (engineering) return "ENGINEERING";

  if (
    isDeliveryProtocolSigned(handover) &&
    !hasOpenIssueFromComments({
      handover,
      action: trimField(input.actionRaw),
      customerService: trimField(input.customerServiceRaw),
      warnings: trimField(input.warningsRaw),
    })
  ) {
    return "RESOLVED";
  }

  return "PENDING";
}

function deriveCustomerServiceNotes(input: MasterSheetCaseInput): string {
  const customerService = trimField(input.customerServiceRaw);
  if (customerService) return customerService;

  const handover = trimField(input.handoverRaw);
  if (
    isDeliveryProtocolSigned(handover) &&
    deriveCustomerServiceStatus(input) === "RESOLVED"
  ) {
    return handover || DELIVERY_PROTOCOL_SIGNED_NOTE;
  }

  return AWAITING_RESPONSE_NOTE;
}

export function buildMasterSheetCases(input: MasterSheetCaseInput): ImportCase[] {
  const feedbackOld = trimField(input.feedbackOldRaw);
  const legal = trimField(input.legalRaw);

  const cases: ImportCase[] = [
    {
      notes: deriveCustomerServiceNotes(input),
      category: "CUSTOMER_SERVICE",
      status: deriveCustomerServiceStatus(input),
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
