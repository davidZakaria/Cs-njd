import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/cs-agent-scope", () => ({
  resolveCsAgentScope: vi.fn(async () => ({
    loginUserId: "cs-1",
    effectiveAgentId: "cs-1",
    isPreview: false,
  })),
  canAccessUnitAsCsAgent: vi.fn(() => false),
}));

import { canDownloadSignedProtocol, resolveSignedProtocolAccess } from "@/lib/auth/signed-protocol-access";

describe("resolveSignedProtocolAccess", () => {
  it("lets CS agents upload portfolio files on any unit", async () => {
    const result = await resolveSignedProtocolAccess(
      { id: "cs-1", role: "CS_AGENT" },
      "other-agent-id"
    );
    expect(result.canUpload).toBe(true);
  });
});

describe("canDownloadSignedProtocol", () => {
  const unassignedUnit = { id: "u1", agentId: "other-agent" };

  it("lets CS agents download files on any unit", () => {
    expect(
      canDownloadSignedProtocol(
        { id: "cs-1", role: "CS_AGENT" },
        unassignedUnit.agentId,
        null
      )
    ).toBe(true);
  });

  it("lets operations and department staff download portfolio files", () => {
    expect(
      canDownloadSignedProtocol(
        { id: "ops-1", role: "OPERATIONS" },
        unassignedUnit.agentId,
        null
      )
    ).toBe(true);
    expect(
      canDownloadSignedProtocol(
        { id: "legal-1", role: "LEGAL" },
        unassignedUnit.agentId,
        null
      )
    ).toBe(true);
    expect(
      canDownloadSignedProtocol(
        { id: "fin-1", role: "FINANCE" },
        unassignedUnit.agentId,
        null
      )
    ).toBe(true);
  });

  it("denies engineers and community management", () => {
    expect(
      canDownloadSignedProtocol(
        { id: "eng-1", role: "ENGINEER" },
        unassignedUnit.agentId,
        null
      )
    ).toBe(false);
    expect(
      canDownloadSignedProtocol(
        { id: "cm-1", role: "COMMUNITY_MANAGEMENT" },
        unassignedUnit.agentId,
        null
      )
    ).toBe(false);
  });
});
