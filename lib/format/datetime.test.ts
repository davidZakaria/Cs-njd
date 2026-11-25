import { describe, expect, it } from "vitest";

import {
  APP_DISPLAY_TIME_ZONE,
  cairoCalendarDayKey,
  formatDateTime,
} from "./datetime";

describe("formatDateTime", () => {
  it("uses Africa/Cairo for display", () => {
    expect(APP_DISPLAY_TIME_ZONE).toBe("Africa/Cairo");
  });

  it("builds Cairo calendar day keys", () => {
    expect(cairoCalendarDayKey(new Date("2026-11-24T22:30:00.000Z"))).toBe(
      "2026-11-25"
    );
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

  it("allows dateStyle and timeStyle without mixing granular date fields", () => {
    const utcInstant = new Date("2026-09-30T00:17:17.000Z");
    expect(() =>
      formatDateTime(utcInstant, "en", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    ).not.toThrow();
    const label = formatDateTime(utcInstant, "en", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    expect(label.length).toBeGreaterThan(0);
  });
});
