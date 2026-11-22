export type CallOutcome = "answered" | "not_answered" | "unknown";

/** Legacy note sniffing — not used for Call Logs inbox dispatch. */
export function parseCallLogOutcome(notes: string): CallOutcome {
  const text = notes.trim();
  if (!text) return "unknown";

  if (
    /(not\s+answered|no\s+answer|unanswered|didn't\s+answer|لم\s*يرد|لم يتم\s*الرد|ما\s*رد)/iu.test(
      text
    )
  ) {
    return "not_answered";
  }

  if (/(answered|تم\s*الرد|رد\s*العميل|تم\s*الاتصال)/iu.test(text)) {
    return "answered";
  }

  return "unknown";
}