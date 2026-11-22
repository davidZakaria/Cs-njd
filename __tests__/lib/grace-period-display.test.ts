import { describe, expect, it } from "vitest";

import { formatGracePeriodLabel } from "@/lib/format/grace-period-display";

describe("formatGracePeriodLabel", () => {
  it("localizes Active until Dec 2026 for Arabic", () => {
    const label = formatGracePeriodLabel("Active until Dec 2026", "ar", (month, year) =>
      `سارية حتى ${month} ${year}`
    );
    expect(label).toMatch(/سارية حتى/);
    expect(label).not.toMatch(/Active until/i);
    expect(label).not.toMatch(/[0-9]/);
    expect(label).toMatch(/[٠-٩]/);
  });
});