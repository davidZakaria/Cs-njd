import { describe, expect, it } from "vitest";

import {
  formatUnitDisplayDate,
  resolveUnitDisplayFields,
  serializeUnitDisplayFields,
} from "@/lib/units/unit-display-fields";

describe("resolveUnitDisplayFields", () => {
  const delivery = new Date("2026-08-01T00:00:00.000Z");
  const preliminary = new Date("2025-03-01T00:00:00.000Z");
  const finalSale = new Date("2025-09-15T00:00:00.000Z");
  const signedProtocol = new Date("2025-04-20T00:00:00.000Z");
  const finishingContract = new Date("2025-06-01T00:00:00.000Z");

  it("prefers workflow contractDate over fallbacks", () => {
    const resolved = resolveUnitDisplayFields({
      contractWorkflow: {
        contractDate: preliminary,
        deliveryDate: delivery,
        finalSaleContractDate: finalSale,
        signedProtocolDate: signedProtocol,
      },
      finishing: {
        finishingType: "FULLY_FINISHED",
        contractDate: finishingContract,
      },
    });
    expect(resolved.deliveryDate).toEqual(delivery);
    expect(resolved.saleContractDate).toEqual(preliminary);
    expect(resolved.saleContractDateSource).toBe("contractWorkflow.contractDate");
    expect(resolved.finishingContractDate).toEqual(finishingContract);
    expect(resolved.finishingType).toBe("FULLY_FINISHED");
  });

  it("falls back to finalSaleContractDate when preliminary date missing", () => {
    const resolved = resolveUnitDisplayFields({
      contractWorkflow: {
        contractDate: null,
        deliveryDate: delivery,
        finalSaleContractDate: finalSale,
      },
      finishing: { finishingType: "SEMI_FINISHED", contractDate: null },
    });
    expect(resolved.saleContractDate).toEqual(finalSale);
    expect(resolved.saleContractDateSource).toBe(
      "contractWorkflow.finalSaleContractDate"
    );
  });

  it("falls back to signedProtocolDate when other sale dates missing", () => {
    const resolved = resolveUnitDisplayFields({
      contractWorkflow: {
        contractDate: null,
        deliveryDate: delivery,
        signedProtocolDate: signedProtocol,
      },
      finishing: { finishingType: "CORE_AND_SHELL", contractDate: null },
    });
    expect(resolved.saleContractDate).toEqual(signedProtocol);
    expect(resolved.saleContractDateSource).toBe(
      "contractWorkflow.signedProtocolDate"
    );
  });

  it("ignores soft-deleted workflow", () => {
    const resolved = resolveUnitDisplayFields({
      contractWorkflow: {
        contractDate: preliminary,
        deliveryDate: delivery,
        deletedAt: new Date(),
      },
      finishing: { finishingType: "FULLY_FINISHED", contractDate: null },
    });
    expect(resolved.deliveryDate).toBeNull();
    expect(resolved.saleContractDate).toBeNull();
  });

  it("serializes to ISO strings", () => {
    const resolved = resolveUnitDisplayFields({
      contractWorkflow: { contractDate: preliminary, deliveryDate: delivery },
      finishing: { finishingType: "FULLY_FINISHED", contractDate: null },
    });
    const serial = serializeUnitDisplayFields(resolved);
    expect(serial.deliveryDate).toBe(delivery.toISOString());
    expect(serial.saleContractDate).toBe(preliminary.toISOString());
    expect(serial.finishingType).toBe("FULLY_FINISHED");
  });
});

describe("formatUnitDisplayDate", () => {
  it("formats Arabic dates with Arabic-Indic digits", () => {
    const label = formatUnitDisplayDate(
      new Date("2025-03-01T00:00:00.000Z"),
      "ar"
    );
    expect(label).toBeTruthy();
    expect(label).toMatch(/[٠-٩]/);
  });

  it("returns null for empty values", () => {
    expect(formatUnitDisplayDate(null, "en")).toBeNull();
  });
});