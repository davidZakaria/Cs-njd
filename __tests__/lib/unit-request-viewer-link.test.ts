import { describe, expect, it } from "vitest";

import { unitRequestViewerLinkForRole } from "@/lib/requests/viewer-link";

describe("unitRequestViewerLinkForRole", () => {
  it("routes Operations to operations workspaces by request type", () => {
    expect(
      unitRequestViewerLinkForRole(
        "OPERATIONS",
        "req-1",
        "ARCHIVE_CHECK"
      )
    ).toBe("/operations/archive-checks/req-1");
    expect(
      unitRequestViewerLinkForRole(
        "OPERATIONS",
        "req-2",
        "ARCHIVE_FILE_REQUEST"
      )
    ).toBe("/operations/requests/req-2");
  });

  it("keeps standard requests link for Legal and Finance", () => {
    expect(
      unitRequestViewerLinkForRole("LEGAL", "req-3", "CONTRACT_ISSUE_OR_AMENDMENT")
    ).toBe("/requests/req-3");
    expect(
      unitRequestViewerLinkForRole("FINANCE", "req-4", "REFUND")
    ).toBe("/requests/req-4");
  });

  it("falls back to requests for Operations on non-archive types", () => {
    expect(unitRequestViewerLinkForRole("OPERATIONS", "req-5", "REFUND")).toBe(
      "/requests/req-5"
    );
  });
});