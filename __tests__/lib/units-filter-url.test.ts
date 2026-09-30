import { describe, expect, it } from "vitest";
import {
  buildUnitsFilterUrl,
  matchesUnitsHandoverGroup,
  parseUnitsPageFilters,
} from "@/lib/units/units-filter-url";

describe("units-filter-url", () => {
  it("builds units list URLs with handover groups", () => {
    expect(buildUnitsFilterUrl()).toBe("/units");
    expect(buildUnitsFilterUrl({ handover: "delivered" })).toBe(
      "/units?handover=delivered"
    );
    expect(buildUnitsFilterUrl({ handover: "legal" })).toBe(
      "/units?handover=legal"
    );
  });

  it("parses handover query params", () => {
    expect(parseUnitsPageFilters({})).toEqual({ handover: "all" });
    expect(parseUnitsPageFilters({ handover: "delivered" })).toEqual({
      handover: "delivered",
    });
    expect(parseUnitsPageFilters({ handover: "legal" })).toEqual({
      handover: "legal",
    });
    expect(parseUnitsPageFilters({ handover: "invalid" })).toEqual({
      handover: "all",
    });
  });

  it("matches handover groups used on the dashboard", () => {
    expect(matchesUnitsHandoverGroup("DELIVERED", "delivered")).toBe(true);
    expect(matchesUnitsHandoverGroup("DELIVERY_PROTOCOL", "delivered")).toBe(
      true
    );
    expect(matchesUnitsHandoverGroup("PENDING", "delivered")).toBe(false);

    expect(matchesUnitsHandoverGroup("LEGAL_DISPUTE", "legal")).toBe(true);
    expect(matchesUnitsHandoverGroup("DELIVERY_WARNING", "legal")).toBe(true);
    expect(matchesUnitsHandoverGroup("CANCELLED", "legal")).toBe(false);
  });
});
