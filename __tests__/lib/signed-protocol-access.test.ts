import { describe, expect, it } from "vitest";

import { canDownloadSignedProtocol } from "@/lib/auth/signed-protocol-access";

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
