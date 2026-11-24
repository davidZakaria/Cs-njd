import { auditFieldLabel } from "@/lib/audit/field-labels";

export function formatAuditExportFilters(
  value: unknown,
  locale: "en" | "ar"
): string {
  if (value == null) {
    return locale === "ar" ? "لا شيء" : "None";
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return String(value);
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter(
    (k) => record[k] != null && record[k] !== ""
  );
  if (keys.length === 0) {
    return locale === "ar" ? "لا شيء" : "None";
  }

  return keys
    .map((key) => {
      const label = auditFieldLabel("AuditLog", `filter_${key}`, locale);
      const raw = record[key];
      const formatted =
        raw == null || raw === ""
          ? locale === "ar"
            ? "—"
            : "—"
          : typeof raw === "object"
            ? JSON.stringify(raw)
            : String(raw);
      return `${label}: ${formatted}`;
    })
    .join(locale === "ar" ? "؛ " : "; ");
}