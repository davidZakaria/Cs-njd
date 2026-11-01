import { describe, expect, it } from "vitest";

import {
  formatUnitRequestPickerLabel,
  mapUnitRowToRequestPickerOption,
  resolvePrimaryClientName,
  unitMatchesRequestPickerSearchQuery,
  unitWhereVisibleForRequestUnitPicker,
} from "@/lib/units/unit-request-search";

describe("unit request picker search", () => {
  it("formats option label as UNITCODE · Project · Client", () => {
    expect(formatUnitRequestPickerLabel("A-101", "Green Avenue", "Ahmed Ali")).toBe(
      "A-101 · Green Avenue · Ahmed Ali"
    );
  });

  it("prefers PRIMARY unit client over legacy client field", () => {
    expect(
      resolvePrimaryClientName({
        client: { name: "Legacy Name" },
        unitClients: [{ role: "PRIMARY", client: { name: "Primary Name" } }],
      })
    ).toBe("Primary Name");
  });

  it("maps unit rows to picker options", () => {
    expect(
      mapUnitRowToRequestPickerOption({
        id: "unit-1",
        unitCode: "B-2",
        project: { name: "Jamila" },
        client: null,
        unitClients: [{ role: "PRIMARY", client: { name: "Sara" } }],
      })
    ).toEqual({
      unitId: "unit-1",
      unitCode: "B-2",
      projectName: "Jamila",
      clientName: "Sara",
      label: "B-2 · Jamila · Sara",
    });
  });

  it("includes project name in search clauses", () => {
    const where = unitMatchesRequestPickerSearchQuery("green");
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { project: { name: { contains: "green", mode: "insensitive" } } },
      ])
    );
  });

  it("allows any role that may create requests to see all active units", () => {
    expect(unitWhereVisibleForRequestUnitPicker("CS_AGENT")).toEqual({});
    expect(unitWhereVisibleForRequestUnitPicker("MANAGEMENT")).toEqual({});
    expect(unitWhereVisibleForRequestUnitPicker("OPERATIONS")).toEqual({
      id: { in: [] },
    });
  });
});
