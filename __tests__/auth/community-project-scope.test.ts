import { describe, expect, it } from "vitest";

import { isCommunityManagedProject } from "@/lib/auth/community-project-scope";

describe("community project scope", () => {
  it("matches Jamila by canonical English name", () => {
    expect(
      isCommunityManagedProject({
        id: "proj-jamila",
        name: "JAMILA NORTH COAST",
      })
    ).toBe(true);
  });

  it("matches project names containing Jamila", () => {
    expect(
      isCommunityManagedProject({ id: "x", name: "Jamila Phase 2" })
    ).toBe(true);
  });

  it("matches Arabic Jamila hint", () => {
    expect(
      isCommunityManagedProject({
        id: "x",
        name: "جميلة الساحل الشمالي",
      })
    ).toBe(true);
  });

  it("rejects other NJD projects", () => {
    expect(
      isCommunityManagedProject({ id: "x", name: "GREEN AVENUE" })
    ).toBe(false);
  });
});
