import { describe, expect, it } from "vitest";

import { getHomeRoute } from "@/lib/rbac";

describe("notifications access redirect targets", () => {
  it("sends department roles to their home, not /dashboard", () => {
    expect(getHomeRoute("LEGAL")).toBe("/legal");
    expect(getHomeRoute("FINANCE")).toBe("/finance");
    expect(getHomeRoute("OPERATIONS")).toBe("/operations");
  });
});