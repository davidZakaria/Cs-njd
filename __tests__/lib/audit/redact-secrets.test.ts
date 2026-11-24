import { describe, expect, it } from "vitest";

import {
  AUDIT_REDACTED,
  auditJsonNeedsRedaction,
  redactAuditSnapshot,
} from "@/lib/audit/redact-secrets";

describe("redactAuditSnapshot", () => {
  it("redacts sensitive keys at any depth", () => {
    const input = {
      name: "Fake User",
      password: "plain-secret",
      nested: {
        twoFactorSecret: "ABCDEF",
        profile: {
          resetToken: "tok_fake_12345",
        },
      },
      recoveryCodes: ["111111", "222222"],
    };

    const out = redactAuditSnapshot(input) as typeof input;
    expect(out.password).toBe(AUDIT_REDACTED);
    expect(out.nested.twoFactorSecret).toBe(AUDIT_REDACTED);
    expect(out.nested.profile.resetToken).toBe(AUDIT_REDACTED);
    expect(out.recoveryCodes).toEqual([AUDIT_REDACTED, AUDIT_REDACTED]);
    expect(out.name).toBe("Fake User");
  });

  it("detects when stored JSON still needs redaction", () => {
    const dirty = { passwordHash: "bcrypt-fake-hash" };
    expect(auditJsonNeedsRedaction(dirty)).toBe(true);
    expect(auditJsonNeedsRedaction({ name: "Safe" })).toBe(false);
  });
});