import { describe, expect, it } from "vitest";

import { resolveUnitClientEditMode } from "@/lib/auth/unit-roles";

describe("resolveUnitClientEditMode", () => {
  it("gives CS agents contact edit on any unit", () => {
    expect(resolveUnitClientEditMode("CS_AGENT")).toBe("phoneAddress");
  });

  it("gives community management add-only extras mode", () => {
    expect(resolveUnitClientEditMode("COMMUNITY_MANAGEMENT")).toBe(
      "communityExtras"
    );
  });

  it("gives management admin mode", () => {
    expect(resolveUnitClientEditMode("MANAGEMENT")).toBe("admin");
  });
});
