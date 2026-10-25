import { describe, expect, it } from "vitest";
import {
  buildUnitsFilterUrl,
  buildUnitsPageUrl,
  matchesUnitsHandoverGroup,
  parseUnitsPageFilters,
  resolveUnitsProjectFilterParam,
} from "@/lib/units/units-filter-url";

describe("units-filter-url", () => {
  it("builds units list URLs with handover and metric filters", () => {
    expect(buildUnitsFilterUrl()).toBe("/units");
    expect(buildUnitsFilterUrl({ handover: "delivered" })).toBe(
      "/units?handover=delivered"
    );
    expect(buildUnitsFilterUrl({ handover: "atRisk" })).toBe(
      "/units?handover=atRisk"
    );
    expect(
      buildUnitsFilterUrl({ delivery: "overdue", signedProtocol: "missing" })
    ).toBe("/units?delivery=overdue&signedProtocol=missing");
  });

  it("parses handover and executive filter query params", () => {
    expect(parseUnitsPageFilters({})).toEqual({
      handover: "all",
      delivery: "all",
      fees: "all",
      signedProtocol: "all",
      agent: "all",
      project: "all",
    });
    expect(parseUnitsPageFilters({ handover: "delivered" })).toEqual({
      handover: "delivered",
      delivery: "all",
      fees: "all",
      signedProtocol: "all",
      agent: "all",
      project: "all",
    });
    expect(parseUnitsPageFilters({ handover: "atRisk", agent: "unassigned" })).toEqual({
      handover: "atRisk",
      delivery: "all",
      fees: "all",
      signedProtocol: "all",
      agent: "unassigned",
      project: "all",
    });
    expect(parseUnitsPageFilters({ handover: "invalid" })).toEqual({
      handover: "all",
      delivery: "all",
      fees: "all",
      signedProtocol: "all",
      agent: "all",
      project: "all",
    });
  });

  it("round-trips page filters through the units URL", () => {
    const filters = parseUnitsPageFilters({
      handover: "delivered",
      project: "green-avenue",
      agent: "unassigned",
    });
    expect(buildUnitsPageUrl(filters)).toBe(
      "/units?handover=delivered&agent=unassigned&project=green-avenue"
    );
    expect(
      resolveUnitsProjectFilterParam("GREEN AVENUE", ["GREEN AVENUE", "JURA"])
    ).toBe("green-avenue");
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
    expect(matchesUnitsHandoverGroup("CANCELLED", "atRisk")).toBe(true);
  });
});
