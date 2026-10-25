import { describe, expect, it } from "vitest";

import {
  parseUnitsFilterTodayStart,
  unitsFilterTodayMemoKey,
} from "@/lib/units/filter-today-start";

describe("filter-today-start", () => {
  it("parses the same calendar day to a stable timestamp", () => {
    const iso = "2026-10-25T00:00:00.000Z";
    const a = parseUnitsFilterTodayStart(iso);
    const b = parseUnitsFilterTodayStart(iso);
    expect(a?.getTime()).toBe(b?.getTime());
    expect(unitsFilterTodayMemoKey(iso)).toBe("2026-10-25");
  });

  it("returns null when iso is missing", () => {
    expect(parseUnitsFilterTodayStart(undefined)).toBeNull();
    expect(unitsFilterTodayMemoKey(undefined)).toBe("");
  });
});
