import { describe, expect, it } from "vitest";

import { csAgentUnitProfileFormSchema } from "@/lib/validations/unit-profile";

describe("csAgentUnitProfileFormSchema", () => {
  it("requires a non-empty client name", () => {
    const result = csAgentUnitProfileFormSchema.safeParse({
      unitId: "unit-1",
      clientName: "",
      email: "N/A",
      nationalId: "  ",
      phone1: "0100",
      address1: "Street",
      type: "APARTMENT",
    });

    expect(result.success).toBe(false);
  });

  it("accepts identity and contact fields for CS saves", () => {
    const result = csAgentUnitProfileFormSchema.safeParse({
      unitId: "unit-1",
      clientName: "Name",
      email: "N/A",
      nationalId: "123",
      phone1: "0100",
      address1: "Street",
      type: "APARTMENT",
    });

    expect(result.success).toBe(true);
  });

  it("still validates editable phone fields", () => {
    const result = csAgentUnitProfileFormSchema.safeParse({
      unitId: "unit-1",
      clientName: "Name",
      phone1: "   ",
      type: "APARTMENT",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone1).toBeNull();
    }
  });
});
