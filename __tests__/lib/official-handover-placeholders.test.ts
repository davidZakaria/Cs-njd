import { describe, expect, it } from "vitest";

import { buildOfficialHandoverFieldValues } from "@/lib/official-documents/handover/field-values";
import { buildOfficialHandoverHtml } from "@/lib/official-documents/handover/render-pdf";
import type { HandoverTemplateKey } from "@/lib/print/handover-templates/types";
import type { UnitMergeInput } from "@/lib/official-documents/merge-fields";

const completeSampleUnit: UnitMergeInput = {
  unitCode: "205-7-A",
  area: 145,
  gracePeriod: null,
  contractPricePerMeter: null,
  swapOutgoingUnitCode: null,
  swapOutgoingProjectName: null,
  swappedFromUnitCode: null,
  swappedFromProjectName: null,
  project: { name: "GREEN AVENUE" },
  client: {
    name: "Sample Owner One",
    nationalId: "29001011234567",
    email: "owner1@example.com",
    phone1: "+201012345678",
    phone2: "+201011122233",
    address1: "12 Sample Street, Cairo",
    address2: null,
    phones: [
      { id: "p1", phone: "+201012345678", sortOrder: 0 },
      { id: "p1b", phone: "+201011122233", sortOrder: 1 },
    ],
    addresses: [{ id: "a1", address: "12 Sample Street, Cairo", sortOrder: 0 }],
  },
  unitClients: [
    {
      role: "PRIMARY",
      client: {
        name: "Sample Owner One",
        nationalId: "29001011234567",
        email: "owner1@example.com",
        phone1: "+201012345678",
        phone2: "+201011122233",
        address1: "12 Sample Street, Cairo",
        address2: null,
        phones: [
          { id: "p1", phone: "+201012345678", sortOrder: 0 },
          { id: "p1b", phone: "+201011122233", sortOrder: 1 },
        ],
        addresses: [
          { id: "a1", address: "12 Sample Street, Cairo", sortOrder: 0 },
        ],
      },
    },
    {
      role: "CO_OWNER",
      client: {
        name: "Sample Owner Two",
        nationalId: "29001019876543",
        email: "owner2@example.com",
        phone1: "+201098765432",
        phone2: "+201055566677",
        address1: "34 Co-owner Street, Giza",
        address2: null,
        phones: [
          { id: "p2", phone: "+201098765432", sortOrder: 0 },
          { id: "p2b", phone: "+201055566677", sortOrder: 1 },
        ],
        addresses: [
          { id: "a2", address: "34 Co-owner Street, Giza", sortOrder: 0 },
        ],
      },
    },
  ],
  contractWorkflow: {
    contractDate: new Date("2024-03-10"),
    deliveryDate: new Date("2026-05-17"),
  },
  finishing: {
    finishingType: "CORE_AND_SHELL",
    packageType: "CORE_AND_SHELL",
    packageLabel: null,
    totalFinishingPrice: null,
    pricePerMeter: null,
    doorFees: null,
    aluminumFees: null,
    contractDate: null,
  },
};

const VARIANTS: {
  key: HandoverTemplateKey;
  dual: boolean;
  unit: UnitMergeInput;
}[] = [
  {
    key: "green-avenue",
    dual: false,
    unit: { ...completeSampleUnit, unitClients: [completeSampleUnit.unitClients[0]!] },
  },
  {
    key: "green-avenue-no-insurance",
    dual: false,
    unit: {
      ...completeSampleUnit,
      unitClients: [completeSampleUnit.unitClients[0]!],
      finishing: {
        ...completeSampleUnit.finishing!,
        finishingType: "FULLY_FINISHED",
        packageType: "PACKAGE_1",
      },
    },
  },
  { key: "green-avenue-dual", dual: true, unit: completeSampleUnit },
  {
    key: "green-avenue-dual-no-insurance",
    dual: true,
    unit: {
      ...completeSampleUnit,
      finishing: {
        ...completeSampleUnit.finishing!,
        finishingType: "FULLY_FINISHED",
        packageType: "PACKAGE_1",
      },
    },
  },
  {
    key: "jura",
    dual: false,
    unit: {
      ...completeSampleUnit,
      project: { name: "JURA" },
      unitClients: [completeSampleUnit.unitClients[0]!],
      finishing: null,
    },
  },
  {
    key: "jura-dual",
    dual: true,
    unit: {
      ...completeSampleUnit,
      project: { name: "JURA" },
      finishing: null,
    },
  },
];

describe("official handover HTML placeholders", () => {
  for (const { key, dual, unit } of VARIANTS) {
    it(`fills all placeholders for ${key}`, () => {
      const { handoverFields, missingKeys } = buildOfficialHandoverFieldValues(
        unit,
        "ar"
      );
      expect(missingKeys).toEqual([]);

      const html = buildOfficialHandoverHtml({
        templateKey: key,
        fields: handoverFields,
        watermarkDraft: false,
      });

      expect(html).not.toMatch(/0000000000000/);
      expect(html).not.toMatch(/000000000000000/);
      expect(html).not.toMatch(/\(00\/00\/0000\)/);
      expect(html).not.toContain('class="missing-field"');
      expect(html).toContain("Sample Owner One");
      expect(html).toContain("29001011234567");
      expect(html).toContain("+201012345678");
      expect(html).toContain('dir="ltr"');

      if (dual && key.startsWith("green")) {
        expect(html).toContain("Sample Owner Two");
        expect(html).toContain("29001019876543");
        const declBlocks = html.match(/أقر أنا الموقع أدناه/g) ?? [];
        expect(declBlocks.length).toBe(2);
      }

      if (dual && key.startsWith("jura")) {
        expect(html).toContain("Sample Owner Two");
        expect(html).toContain("2-أقـر");
      }

      if (key.startsWith("jura")) {
        expect(html).toContain("ثانيا : سداد المرافق والعدادات");
        expect(html).toMatch(/ثالثا\s*:\s*وديعة الصيانة وفروق الصيانة/);
        expect(html).toContain("المقر بما فيه");
        expect(html).toContain("توقيع الشركة");
        expect(html).toMatch(/توقيع المالك/);
      }

      if (key.startsWith("green-avenue-dual")) {
        expect(html).toContain("توقيع المشتري الأول");
        expect(html).toContain("توقيع المشتري الثاني");
      }

      expect(html).toContain("print-frame-outer");
      expect(html).toContain(
        key.startsWith("jura") ? "handover-jura" : "handover-green"
      );
    });
  }
});
