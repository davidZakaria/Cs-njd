/** Marker stored in audit snapshots instead of sensitive values. */
export const AUDIT_REDACTED = "[redacted]" as const;

const SENSITIVE_KEY_EXACT = new Set(
  [
    "password",
    "passwordhash",
    "twofactorsecret",
    "sessiontoken",
    "resettoken",
    "refreshtoken",
    "accesstoken",
    "backupcodes",
    "recoverycodes",
    "twofactorbackupcodes",
  ].map((k) => k.toLowerCase())
);

const SENSITIVE_KEY_PARTIALS = [
  "password",
  "totp",
  "backupcode",
  "recoverycode",
  "resettoken",
  "sessiontoken",
];

export function isSensitiveAuditKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (SENSITIVE_KEY_EXACT.has(normalized)) {
    return true;
  }
  return SENSITIVE_KEY_PARTIALS.some(
    (part) => normalized.includes(part) && normalized !== "sessionversion"
  );
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