import { describe, expect, it } from "vitest";

import {
  buildOfficialHandoverDraftBody,
  handoverDraftTitleForKey,
} from "@/lib/official-documents/handover/build-body";
import {
  buildOfficialHandoverFieldValues,
} from "@/lib/official-documents/handover/field-values";
import { listMissingFieldsInBody } from "@/lib/official-documents/handover/missing-fields-ui";
import {
  inferHandoverFinishingDepositApplies,
  inferHandoverTemplateOptionsFromUnit,
  resolveOfficialHandoverTemplateKey,
} from "@/lib/official-documents/handover/infer-variant";
import type { UnitMergeInput } from "@/lib/official-documents/merge-fields";
import { OFFICIAL_HANDOVER_MISSING_OPEN } from "@/lib/official-documents/handover/constants";

const baseClientFields = {
  phone1: null as string | null,
  phone2: null as string | null,
  address1: null as string | null,
  address2: null as string | null,
};

function greenUnit(overrides: Partial<UnitMergeInput> = {}): UnitMergeInput {
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
      name: "Ahmed Ali",
      nationalId: "29001011234567",
      email: "a@example.com",
      ...baseClientFields,
      phones: [{ id: "p1", phone: "+20100000000", sortOrder: 0 }],
      addresses: [{ id: "a1", address: "Cairo", sortOrder: 0 }],
    },
    unitClients: [
      {
        role: "PRIMARY",
        client: {
          name: "Ahmed Ali",
          nationalId: "29001011234567",
          email: "a@example.com",
          ...baseClientFields,
          phones: [{ id: "p1", phone: "+20100000000", sortOrder: 0 }],
          addresses: [{ id: "a1", address: "Cairo", sortOrder: 0 }],
        },
      },
    ],
    contractWorkflow: {
      contractDate: new Date("2024-01-15"),
      deliveryDate: new Date("2026-06-01"),
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
    ...overrides,
  };
}

describe("official handover variant selection", () => {
  it("selects Green Avenue deposit template for buyer finishing", () => {
    const unit = greenUnit();
    expect(inferHandoverFinishingDepositApplies(unit)).toBe(true);
    expect(inferHandoverTemplateOptionsFromUnit(unit)).toEqual({
      insurance: true,
      dualSignature: false,
    });
    expect(resolveOfficialHandoverTemplateKey(unit)).toBe("green-avenue");
  });

  it("selects no-deposit template for company-finished units", () => {
    const unit = greenUnit({
      finishing: {
        finishingType: "FULLY_FINISHED",
        packageType: "PACKAGE_1",
        packageLabel: null,
        totalFinishingPrice: 100,
        pricePerMeter: 1,
        doorFees: null,
        aluminumFees: null,
        contractDate: null,
      },
    });
    expect(resolveOfficialHandoverTemplateKey(unit)).toBe(
      "green-avenue-no-insurance"
    );
  });

  it("selects dual-owner Green Avenue template when co-owner exists", () => {
    const unit = greenUnit({
      unitClients: [
        ...greenUnit().unitClients,
        {
          role: "CO_OWNER",
          client: {
            name: "Sara Ali",
            nationalId: "29001019876543",
            email: null,
            ...baseClientFields,
            phones: [],
            addresses: [],
          },
        },
      ],
    });
    expect(resolveOfficialHandoverTemplateKey(unit)).toBe("green-avenue-dual");
  });

  it("selects Jura dual template for two owners", () => {
    const unit = greenUnit({
      project: { name: "JURA" },
      finishing: null,
      unitClients: [
        ...greenUnit().unitClients,
        {
          role: "CO_OWNER",
          client: {
            name: "Sara Ali",
            nationalId: "29001019876543",
            email: null,
            ...baseClientFields,
            phones: [],
            addresses: [],
          },
        },
      ],
    });
    expect(resolveOfficialHandoverTemplateKey(unit)).toBe("jura-dual");
  });

  it("honours legal override of template key", () => {
    const unit = greenUnit();
    expect(
      resolveOfficialHandoverTemplateKey(unit, "green-avenue-dual-no-insurance")
    ).toBe("green-avenue-dual-no-insurance");
  });
});

describe("official handover placeholder fill", () => {
  it("fills owner and unit placeholders in draft body", () => {
    const unit = greenUnit();
    const key = resolveOfficialHandoverTemplateKey(unit)!;
    const { handoverFields, missingKeys } = buildOfficialHandoverFieldValues(
      unit,
      "ar"
    );
    expect(missingKeys).toEqual([]);
    const body = buildOfficialHandoverDraftBody({
      templateKey: key,
      fields: handoverFields,
    });
    expect(body).toContain("Ahmed Ali");
    expect(body).toContain("101");
    expect(body).toContain(handoverDraftTitleForKey(key).split("—")[0]!.trim());
    expect(body).not.toContain(`${OFFICIAL_HANDOVER_MISSING_OPEN}owner1_name`);
  });

  it("marks missing national ID with visible tokens", () => {
    const unit = greenUnit({
      client: {
        name: "Ahmed Ali",
        nationalId: null,
        email: null,
        ...baseClientFields,
        phones: [],
        addresses: [],
      },
      unitClients: [
        {
          role: "PRIMARY",
          client: {
            name: "Ahmed Ali",
            nationalId: null,
            email: null,
            ...baseClientFields,
            phones: [],
            addresses: [],
          },
        },
      ],
    });
    const { handoverFields } = buildOfficialHandoverFieldValues(unit, "ar");
    const body = buildOfficialHandoverDraftBody({
      templateKey: "green-avenue",
      fields: handoverFields,
    });
    expect(listMissingFieldsInBody(body)).toContain("owner1_national_id");
  });
});

describe("renderOfficialHandoverRecordPdf", () => {
  it(
    "renders all six master variants",
    async () => {
      const { loadPdfFontAssets } = await import(
        "@/lib/official-documents/pdf-fonts"
      );
      await loadPdfFontAssets();
      const { renderOfficialHandoverRecordPdf } = await import(
        "@/lib/official-documents/handover/render-pdf"
      );
    const unit = greenUnit();
    const keys = [
      "green-avenue",
      "green-avenue-no-insurance",
      "green-avenue-dual",
      "green-avenue-dual-no-insurance",
      "jura",
      "jura-dual",
    ] as const;

    for (const templateKey of keys) {
      const sampleUnit =
        templateKey.startsWith("jura")
          ? greenUnit({ project: { name: "JURA" }, finishing: null })
          : unit;
      const { handoverFields } = buildOfficialHandoverFieldValues(sampleUnit, "ar");
      const body = buildOfficialHandoverDraftBody({ templateKey, fields: handoverFields });
      const pdf = await renderOfficialHandoverRecordPdf({
        templateKey,
        body,
        companyAddress: "New Jersey for Real Estate Development",
        watermarkDraft: true,
      });
      expect(pdf.byteLength).toBeGreaterThan(8000);
    }
  },
    120_000
  );
});
