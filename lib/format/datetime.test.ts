import { describe, expect, it } from "vitest";

import { APP_DISPLAY_TIME_ZONE, formatDateTime } from "./datetime";

describe("formatDateTime", () => {
  it("uses Africa/Cairo for display", () => {
    expect(APP_DISPLAY_TIME_ZONE).toBe("Africa/Cairo");
  });

  it("shows Cairo local time for a UTC instant (3h ahead of UTC)", () => {
    const utcInstant = new Date("2026-09-30T00:17:17.000Z");
    const label = formatDateTime(utcInstant, "en");
    expect(label).toMatch(/3:17:17/);
  });

  it("formats Arabic locale without throwing", () => {
    const utcInstant = new Date("2026-09-30T00:17:17.000Z");
    expect(formatDateTime(utcInstant, "ar").length).toBeGreaterThan(0);
  });
});
