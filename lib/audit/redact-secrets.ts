/** Marker stored in audit snapshots instead of sensitive values. */
export const AUDIT_REDACTED = "[redacted]" as const;

/**
 * Exact field names (compared case-insensitively) whose values must never appear in audits.
 */
const SENSITIVE_KEYS = new Set(
  [
    "password",
    "passwordhash",
    "currentpassword",
    "newpassword",
    "confirmpassword",
    "twofactorsecret",
    "totpsecret",
    "otpsecret",
    "sessiontoken",
    "resettoken",
    "refreshtoken",
    "accesstoken",
    "idtoken",
    "backupcodes",
    "recoverycodes",
    "twofactorbackupcodes",
    "mfabackupcodes",
  ].map((k) => k.toLowerCase())
);

/**
 * Substrings allowed only when the whole key is not a known safe boolean/flag field.
 * Do not include "password" — it would hide requiresPasswordChange and similar flags.
 */
const SENSITIVE_KEY_SUBSTRINGS = ["totp", "backupcode", "recoverycode"] as const;

const SAFE_KEYS = new Set(
  ["requirespasswordchange", "sessionversion"].map((k) => k.toLowerCase())
);

export function isSensitiveAuditKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (SAFE_KEYS.has(normalized)) {
    return false;
  }
  if (SENSITIVE_KEYS.has(normalized)) {
    return true;
  }
  return SENSITIVE_KEY_SUBSTRINGS.some((part) => normalized.includes(part));
}

function redactValueAtKey(key: string, value: unknown): unknown {
  if (isSensitiveAuditKey(key)) {
    if (Array.isArray(value)) {
      return value.map(() => AUDIT_REDACTED);
    }
    return AUDIT_REDACTED;
  }
  return redactAuditSnapshot(value);
}

export function redactAuditSnapshot(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditSnapshot(item));
  }
  if (typeof value === "object" && !(value instanceof Date)) {
    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(input)) {
      out[key] = redactValueAtKey(key, child);
    }
    return out;
  }
  return value;
}

export function redactAuditData(
  oldData?: object | null,
  newData?: object | null
): { oldData?: object; newData?: object } {
  return {
    ...(oldData != null
      ? { oldData: redactAuditSnapshot(oldData) as object }
      : {}),
    ...(newData != null
      ? { newData: redactAuditSnapshot(newData) as object }
      : {}),
  };
}

/** Returns true when JSON blobs differ after redaction (for backfill script). */
export function auditJsonNeedsRedaction(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  const redacted = redactAuditSnapshot(value);
  return JSON.stringify(value) !== JSON.stringify(redacted);
}