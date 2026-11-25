import { describe, expect, it } from "vitest";

import arMessages from "@/messages/ar.json";

import {
  APP_DISPLAY_TIME_ZONE,
  cairoCalendarDayKey,
  formatDateTime,
  formatDisplayDate,
  formatDisplayDateTime,
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

  it("formatDisplayDate uses medium style for en-GB", () => {
    const label = formatDisplayDate("2026-11-15T12:00:00.000Z", "en");
    expect(label).toMatch(/15/);
    expect(label).toMatch(/Nov/);
    expect(label).toMatch(/2026/);
  });

  it("formatDisplayDateTime uses en-GB medium date and Cairo short time", () => {
    const label = formatDisplayDateTime("2026-12-09T14:00:00.000Z", "en");
    expect(label).toMatch(/9/);
    expect(label).toMatch(/Dec/);
    expect(label).toMatch(/2026/);
    expect(label).toMatch(/16:00/);
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

describe("Arabic daysOverdueBadge copy", () => {
  it("uses ICU plural forms and is not truncated", () => {
    const badge = arMessages.unitCycle.overdueManagement.daysOverdueBadge;
    expect(badge).toContain("{days, plural");
    expect(badge).toContain("يومين");
    expect(badge).toContain("أيام");
    expect(badge).not.toBe("متأخر {days} ي");
  });
});
