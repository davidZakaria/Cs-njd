import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  formatUnitOwnersDisplayName,
  resolvePrimaryClientName,
} from "@/lib/units/unit-request-search";

describe("load-requests two-owner support", () => {
  it("resolves PRIMARY client name from unitClients array", () => {
    const result = resolvePrimaryClientName({
      client: null,
      unitClients: [
        { role: "PRIMARY", client: { name: "Ahmed Primary" } },
        { role: "CO_OWNER", client: { name: "Sara Co-Owner" } },
      ],
    });
    expect(result).toBe("Ahmed Primary");
  });

  it("resolves PRIMARY client name when both legacy and unitClients exist", () => {
    const result = resolvePrimaryClientName({
      client: { name: "Legacy Client" },
      unitClients: [{ role: "PRIMARY", client: { name: "Ahmed Primary" } }],
    });
    expect(result).toBe("Ahmed Primary");
  });

  it("falls back to legacy client field when no PRIMARY in unitClients", () => {
    const result = resolvePrimaryClientName({
      client: { name: "Legacy Client" },
      unitClients: [],
    });
    expect(result).toBe("Legacy Client");
  });

  it("returns fallback dash when no client data at all", () => {
    const result = resolvePrimaryClientName({
      client: null,
      unitClients: [],
    });
    expect(result).toBe("—");
  });

  it("formats merged slash names as two owners for display", () => {
    const result = formatUnitOwnersDisplayName({
      client: { name: "يوسف شنودة / مريم ماهر" },
      unitClients: [],
    });
    expect(result).toBe("يوسف شنودة · مريم ماهر");
  });

  it("handles CO_OWNER-only scenario with fallback dash", () => {
    const result = resolvePrimaryClientName({
      client: null,
      unitClients: [{ role: "CO_OWNER", client: { name: "Sara Co-Owner" } }],
    });
    expect(result).toBe("—");
  });
});
