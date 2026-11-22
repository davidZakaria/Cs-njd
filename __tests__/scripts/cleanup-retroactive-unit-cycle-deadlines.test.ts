import { describe, expect, it } from "vitest";

import { cleanupApplyFromArgv } from "@/lib/unit-cycle/retroactive-deadline-cleanup";

describe("cleanup-retroactive-unit-cycle-deadlines script flags", () => {
  it("is dry-run by default", () => {
    expect(cleanupApplyFromArgv(["tsx", "scripts/cleanup-retroactive-unit-cycle-deadlines.ts"])).toBe(
      false
    );
  });

  it("writes only when --apply is present", () => {
    expect(
      cleanupApplyFromArgv(["tsx", "scripts/cleanup-retroactive-unit-cycle-deadlines.ts", "--apply"])
    ).toBe(true);
  });
});