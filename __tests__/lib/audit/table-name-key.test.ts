import { describe, expect, it } from "vitest";

import { auditTableNameTranslationKey } from "@/lib/audit/table-name-key";

describe("auditTableNameTranslationKey", () => {
  it("maps audited model names to translation keys", () => {
    expect(auditTableNameTranslationKey("Finishing")).toBe("tables.Finishing");
    expect(auditTableNameTranslationKey("ClientPhone")).toBe("tables.ClientPhone");
  });

  it("returns null for unknown tables", () => {
    expect(auditTableNameTranslationKey("Notification")).toBeNull();
  });
});
