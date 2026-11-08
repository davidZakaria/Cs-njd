import { listMissingFieldsInBody, officialHandoverMissingFieldLabel } from "@/lib/official-documents/handover/missing-fields-ui";

/** Client-side guard before calling generate (matches server missing-field checks). */
export function formatHandoverGenerateBlockedMessage(
  body: string,
  locale: string
): string | null {
  const missing = listMissingFieldsInBody(body);
  if (missing.length === 0) return null;
  const labels = missing.map((key) => officialHandoverMissingFieldLabel(key, locale));
  return locale === "ar"
    ? `لا يمكن إنشاء PDF — أكمل الحقول التالية: ${labels.join("؛ ")}`
    : `Cannot generate PDF — complete the following fields: ${labels.join("; ")}`;
}
