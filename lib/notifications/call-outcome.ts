import type { CallLogOutcome } from "@prisma/client";

export type CallOutcome = "answered" | "not_answered" | "other";

export function parseCallLogOutcome(notes: string): CallOutcome {
  const text = notes.trim();
  if (!text) return "other";

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

  return "other";
}

export function resolveCallOutcome(
  explicit: CallLogOutcome | null | undefined,
  notes: string
): CallOutcome {
  if (explicit === "ANSWERED") return "answered";
  if (explicit === "NO_ANSWER") return "not_answered";
  if (explicit === "OTHER") return "other";
  return parseCallLogOutcome(notes);
}

export function callOutcomePhrase(outcome: CallOutcome): {
  en: string;
  ar: string;
} {
  switch (outcome) {
    case "answered":
      return { en: "answered", ar: "تم الرد" };
    case "not_answered":
      return { en: "no answer", ar: "لم يرد" };
    default:
      return { en: "other", ar: "أخرى" };
  }
}