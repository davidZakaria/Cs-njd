const PHONE_KEY_HINTS = ["phone", "whatsapp", "mobile", "tel"];
const NATIONAL_ID_KEY_HINTS = ["nationalid", "national_id", "nid"];

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_\s-]/g, "");
}

function isPhoneKey(key: string): boolean {
  const n = normalizeKey(key);
  return PHONE_KEY_HINTS.some((hint) => n.includes(hint));
}

function isNationalIdKey(key: string): boolean {
  const n = normalizeKey(key);
  return NATIONAL_ID_KEY_HINTS.some((hint) => n.includes(hint));
}

export function maskPhoneForDisplay(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) {
    return "••••";
  }
  const tail = digits.slice(-4);
  return `••••${tail}`;
}

export function maskNationalIdForDisplay(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return "••••";
  }
  return `${"•".repeat(Math.max(4, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

export function maskSensitiveFieldForDisplay(
  fieldKey: string,
  value: unknown
): string {
  if (value == null || value === "") {
    return "—";
  }
  const text = String(value);
  if (isPhoneKey(fieldKey)) {
    return maskPhoneForDisplay(text);
  }
  if (isNationalIdKey(fieldKey)) {
    return maskNationalIdForDisplay(text);
  }
  return text;
}

export function maskSensitiveSnapshotForDisplay(
  data: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!data) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out[key] = maskSensitiveSnapshotForDisplay(
        value as Record<string, unknown>
      );
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item !== null && typeof item === "object"
          ? maskSensitiveSnapshotForDisplay(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === "string" || typeof value === "number") {
      out[key] = maskSensitiveFieldForDisplay(key, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}