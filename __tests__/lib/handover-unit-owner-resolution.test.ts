import { describe, expect, it } from "vitest";

import {
  handoverOwnerBlockMessage,
  resolveHandoverOwners,
} from "@/lib/official-documents/handover/unit-owner-resolution";
import type { UnitMergeInput } from "@/lib/official-documents/merge-fields";

const baseClientFields = {
  phone1: null as string | null,
  phone2: null as string | null,
  address1: null as string | null,
  address2: null as string | null,
};

function unit(overrides: Partial<UnitMergeInput> = {}): UnitMergeInput {
  return {
    unitCode: "101-3-B",
    area: 120,
    gracePeriod: null,
    contractPricePerMeter: null,
    swapOutgoingUnitCode: null,
    swapOutgoingProjectName: null,
    swappedFromUnitCode: null,
    swappedFromProjectName: null,
    project: { name: "GREEN AVENUE" },
    client: {
      name: "Owner One",
      nationalId: "29001011234567",
      email: null,
      ...baseClientFields,
      phones: [],
      addresses: [],
    },
    unitClients: [
      {
        role: "PRIMARY",
        client: {
          name: "Owner One",
          nationalId: "29001011234567",
          email: null,
          ...baseClientFields,
          phones: [],
          addresses: [],
        },
      },
    ],
    contractWorkflow: null,
    finishing: null,
    ...overrides,
  };
}

describe("resolveHandoverOwners", () => {
  it("treats CO_OWNER row as dual owners", () => {
    const resolution = resolveHandoverOwners(
      unit({
        unitClients: [
          ...unit().unitClients,
          {
            role: "CO_OWNER",
            client: {
              name: "Owner Two",
              nationalId: "29001019876543",
              email: null,
              ...baseClientFields,
              phones: [],
              addresses: [],
            },
          },
        ],
      })
    );
    expect(resolution.mode).toBe("dual");
    if (resolution.mode === "dual") {
      expect(resolution.source).toBe("co_owner_row");
      expect(resolution.owner2Name).toBe("Owner Two");
    }
  });

  it("splits merged slash names into dual owners", () => {
    const merged = "يوسف شنودة / مريم ماهر";
    const resolution = resolveHandoverOwners(
      unit({
        client: {
          name: merged,
          nationalId: "29001011234567",
          email: null,
          ...baseClientFields,
          phones: [],
          addresses: [],
        },
        unitClients: [
          {
            role: "PRIMARY",
            client: {
              name: merged,
              nationalId: "29001011234567",
              email: null,
              ...baseClientFields,
              phones: [],
              addresses: [],
            },
          },
        ],
      })
    );
    expect(resolution.mode).toBe("dual");
    if (resolution.mode === "dual") {
      expect(resolution.source).toBe("merged_name");
      expect(resolution.owner1Name).toBe("يوسف شنودة");
      expect(resolution.owner2Name).toBe("مريم ماهر");
    }
  });

  it("accepts Arabic spacing around slash", () => {
    const resolution = resolveHandoverOwners(
      unit({
        client: {
          name: "أحمد  /  سارة",
          nationalId: null,
          email: null,
          ...baseClientFields,
          phones: [],
          addresses: [],
        },
        unitClients: [],
      })
    );
    expect(resolution.mode).toBe("dual");
  });

  it("blocks three or more slash-separated names", () => {
    const resolution = resolveHandoverOwners(
      unit({
        client: {
          name: "A / B / C",
          nationalId: null,
          email: null,
          ...baseClientFields,
          phones: [],
          addresses: [],
        },
        unitClients: [],
      })
    );
    expect(resolution.mode).toBe("blocked");
    expect(handoverOwnerBlockMessage(resolution, "en")).toMatch(/3 owners/);
  });

  it("keeps single owner when no slash", () => {
    expect(resolveHandoverOwners(unit()).mode).toBe("single");
  });
});