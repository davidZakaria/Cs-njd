import { describe, expect, it } from "vitest";

import {
  formatUnitOwnersDisplayName,
  resolvePrimaryClientId,
} from "@/lib/units/unit-request-search";
import { stripExcelNumericSuffix, normalizePhone } from "@/lib/utils/arabic-normalize";

describe("resolvePrimaryClientId", () => {
  it("prefers PRIMARY unitClient link over legacy clientId", () => {
    expect(
      resolvePrimaryClientId({
        clientId: "legacy-id",
        unitClients: [{ role: "PRIMARY", clientId: "primary-id" }],
      })
    ).toBe("primary-id");
  });

  it("falls back to legacy clientId when no PRIMARY link", () => {
    expect(
      resolvePrimaryClientId({
        clientId: "legacy-id",
        unitClients: [{ role: "CO_OWNER", clientId: "co-id" }],
      })
    ).toBe("legacy-id");
  });

  it("returns null when only unitClients exist without legacy clientId", () => {
    expect(
      resolvePrimaryClientId({
        clientId: null,
        unitClients: [{ role: "PRIMARY", clientId: "primary-only" }],
      })
    ).toBe("primary-only");
  });

  it("falls back to legacy clientId when unitClients is undefined", () => {
    expect(
      resolvePrimaryClientId({
        clientId: "legacy-only",
        unitClients: undefined,
      })
    ).toBe("legacy-only");
  });
});

describe("formatUnitOwnersDisplayName in request picker labels", () => {
  it("shows both owners for PRIMARY + CO_OWNER rows", () => {
    const label = formatUnitOwnersDisplayName({
      client: null,
      unitClients: [
        { role: "PRIMARY", client: { name: "Owner One" } },
        { role: "CO_OWNER", client: { name: "Owner Two" } },
      ],
    });
    expect(label).toBe("Owner One · Owner Two");
  });
});

describe("stripExcelNumericSuffix / normalizePhone", () => {
  it("strips trailing .0 from imported phone strings", () => {
    expect(stripExcelNumericSuffix("96599034830.0")).toBe("96599034830");
    expect(normalizePhone("96599034830.0")).toBe("96599034830");
  });
});