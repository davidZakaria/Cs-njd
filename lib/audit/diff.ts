import { formatAuditExportFilters } from "@/lib/audit/format-export-filters";
import { AUDIT_REDACTED, isSensitiveAuditKey } from "@/lib/audit/redact-secrets";
import { maskSensitiveFieldForDisplay } from "@/lib/audit/mask-sensitive";
import { auditFieldLabel } from "@/lib/audit/field-labels";

export type AuditDiffRow = {
  fieldKey: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
};

function formatDisplayValue(
  model: string,
  fieldKey: string,
  value: unknown,
  locale: "en" | "ar"
): string {
  if (model === "AuditLog" && fieldKey === "filters") {
    return formatAuditExportFilters(value, locale);
  }
  if (model === "AuditLog" && fieldKey === "rowCount") {
    if (value == null) return "—";
    return String(value);
  }
  if (value === undefined) {
    return locale === "ar" ? "—" : "—";
  }
  if (value === null) {
    return locale === "ar" ? "فارغ" : "empty";
  }
  if (value === AUDIT_REDACTED) {
    return AUDIT_REDACTED;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "changed" in (value as Record<string, unknown>) &&
    (value as { changed?: boolean }).changed === true
  ) {
    return locale === "ar" ? "تم التغيير" : "changed";
  }
  if (typeof value === "boolean") {
    return value
      ? locale === "ar"
        ? "نعم"
        : "yes"
      : locale === "ar"
        ? "لا"
        : "no";
  }
  if (typeof value === "string" || typeof value === "number") {
    return maskSensitiveFieldForDisplay(fieldKey, value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function collectKeys(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
): string[] {
  const keys = new Set<string>();
  if (oldData) {
    Object.keys(oldData).forEach((k) => keys.add(k));
  }
  if (newData) {
    Object.keys(newData).forEach((k) => keys.add(k));
  }
  const skip = new Set(["id", "createdAt", "updatedAt"]);
  return [...keys].filter((k) => !skip.has(k)).sort();
}

export function buildAuditFieldDiff(
  model: string,
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined,
  locale: "en" | "ar"
): AuditDiffRow[] {
  const oldNorm = oldData ?? null;
  const newNorm = newData ?? null;
  const keys = collectKeys(oldNorm, newNorm);

  return keys.map((fieldKey) => {
    const beforeRaw = oldNorm?.[fieldKey];
    const afterRaw = newNorm?.[fieldKey];
    const before = formatDisplayValue(model, fieldKey, beforeRaw, locale);
    const after = formatDisplayValue(model, fieldKey, afterRaw, locale);
    const sensitivePresent =
      isSensitiveAuditKey(fieldKey) &&
      (beforeRaw !== undefined || afterRaw !== undefined);
    const changed = before !== after || sensitivePresent;
    return {
      fieldKey,
      label: auditFieldLabel(model, fieldKey, locale),
      before,
      after,
      changed,
    };
  });
}