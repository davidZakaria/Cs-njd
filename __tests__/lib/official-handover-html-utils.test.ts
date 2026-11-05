import { describe, expect, it } from "vitest";

import {
  normalizeWesternDigits,
  formatLtrField,
  stripGreenSection2Lead,
} from "@/lib/official-documents/handover/html/utils";
import { buildOfficialHandoverFieldValues } from "@/lib/official-documents/handover/field-values";

describe("handover HTML utils", () => {
  it("strips duplicated ثانيا heading from section body", () => {
    const raw =
      "ثانيا : بيانات الوحدة وحدة سكنية رقم (205) بالطابق (7)";
    expect(stripGreenSection2Lead(raw)).toBe(
      "وحدة سكنية رقم (205) بالطابق (7)"
    );
  });

  it("normalizes Arabic-Indic digits to Western", () => {
    expect(normalizeWesternDigits("١٧/٠٥/٢٠٢٦")).toBe("17/05/2026");
  });

  it("wraps phone numbers in LTR isolate spans", () => {
    const html = formatLtrField("+201012345678");
    expect(html).toContain('dir="ltr"');
    expect(html).toContain("+201012345678");
    expect(html).toContain("<bdi");
  });

  it("uses a single primary address line", () => {
    const { handoverFields } = buildOfficialHandoverFieldValues(
      {
        unitCode: "1-1-A",
        area: 100,
        gracePeriod: null,
        contractPricePerMeter: null,
        swapOutgoingUnitCode: null,
        swapOutgoingProjectName: null,
        swappedFromUnitCode: null,
        swappedFromProjectName: null,
        project: { name: "GREEN AVENUE" },
        client: null,
        unitClients: [
          {
            role: "PRIMARY",
            client: {
              name: "Test",
              nationalId: "123",
              email: null,
              phone1: null,
              phone2: null,
              address1: "Sample Street, Cairo",
              address2: null,
              phones: [],
              addresses: [
                { id: "a1", address: "12 Sample Street, Cairo", sortOrder: 0 },
              ],
            },
          },
        ],
        contractWorkflow: {
          contractDate: new Date("2024-03-10"),
          deliveryDate: new Date("2026-05-17"),
        },
        finishing: null,
      },
      "ar"
    );
    expect(handoverFields.address).toBe("Sample Street, Cairo");
    expect(handoverFields.handoverDate).toBe("17/05/2026");
  });
});
