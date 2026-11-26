import { describe, expect, it } from "vitest";

import { buildAuditFieldDiff } from "@/lib/audit/diff";
import { formatAuditExportFilters } from "@/lib/audit/format-export-filters";
import {
  maskNationalIdForDisplay,
  maskPhoneForDisplay,
  maskSensitiveSnapshotForDisplay,
} from "@/lib/audit/mask-sensitive";
import { AUDIT_REDACTED } from "@/lib/audit/redact-secrets";

describe("mask sensitive display values", () => {
  it("masks phone numbers and national IDs", () => {
    expect(maskPhoneForDisplay("+201012345678")).toMatch(/••••5678$/);
    expect(maskNationalIdForDisplay("29012345678901")).toMatch(/8901$/);
  });

  it("masks nested client snapshots for diff view", () => {
    const masked = maskSensitiveSnapshotForDisplay({
      name: "Demo Client",
      phone1: "+201055512345",
      nationalId: "29912345678903",
    });
    expect(masked?.name).toBe("Demo Client");
    expect(String(masked?.phone1)).toContain("••••");
    expect(String(masked?.nationalId)).toContain("•");
  });
});

describe("formatAuditExportFilters", () => {
  it("renders filter map with translated keys", () => {
    const text = formatAuditExportFilters(
      { q: "demo", tableName: "Client" },
      "en"
    );
    expect(text).toContain("Search: demo");
    expect(text).toContain("Entity type: Client");
    expect(formatAuditExportFilters({}, "en")).toBe("None");
  });
});

describe("buildAuditFieldDiff", () => {
  it("renders labeled before/after rows with redacted secrets", () => {
    const rows = buildAuditFieldDiff(
      "User",
      { name: "Before", password: AUDIT_REDACTED },
      { name: "After", password: { changed: true } },
      "en"
    );
    const password = rows.find((r) => r.fieldKey === "password");
    expect(password?.label).toBe("Password");
    expect(password?.changed).toBe(true);
    expect(password?.after).toBe("changed");
  });

  it("uses Arabic field labels", () => {
    const rows = buildAuditFieldDiff(
      "Client",
      { nationalId: "29912345678903" },
      { nationalId: "29912345678999" },
      "ar"
    );
    const row = rows.find((r) => r.fieldKey === "nationalId");
    expect(row?.label).toBe("الرقم القومي");
  });

  it("resolves user reference ids when labels are provided", () => {
    const labels = new Map<string, string>([
      [`User\0cmuema00m0000l94nfd3g6yqx`, "Nardine Community"],
    ]);
    const rows = buildAuditFieldDiff(
      "Ticket",
      { agentId: null },
      { agentId: "cmuema00m0000l94nfd3g6yqx" },
      "en",
      labels
    );
    const agentRow = rows.find((r) => r.fieldKey === "agentId");
    expect(agentRow?.before).toBe("empty");
    expect(agentRow?.after).toBe("Nardine Community");
  });
});