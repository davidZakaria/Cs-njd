import { describe, expect, it } from "vitest";

import { canSwapUnitClient } from "@/lib/auth/role-permissions";

describe("unit swap permissions", () => {
  it("allows management roles only", () => {
    expect(canSwapUnitClient("MANAGEMENT")).toBe(true);
    expect(canSwapUnitClient("SUPER_ADMIN")).toBe(true);
    expect(canSwapUnitClient("CS_AGENT")).toBe(false);
    expect(canSwapUnitClient("ENGINEER")).toBe(false);
    expect(canSwapUnitClient("COMMUNITY_MANAGEMENT")).toBe(false);
  });
});
