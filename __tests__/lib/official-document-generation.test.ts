import { describe, expect, it } from "vitest";

import {
  buildOfficialDocumentMergeFields,
  interpolateOfficialDocumentTemplate,
} from "@/lib/official-documents/merge-fields";
import {
  canEditOfficialDocumentTemplates,
  canGenerateOfficialDocuments,
  canViewOfficialDocuments,
} from "@/lib/official-documents/permissions";
import { requiredRequestTypeForDocument } from "@/lib/official-documents/request-binding";

describe("official-document merge fields", () => {
  const baseClientFields = {
    phone1: null as string | null,
    phone2: null as string | null,
    address1: null as string | null,
    address2: null as string | null,
  };

  const unit = {
    unitCode: "101-3-B",
    area: 120,
    gracePeriod: "6 months",
    contractPricePerMeter: 45000,
    swapOutgoingUnitCode: null,
    swapOutgoingProjectName: null,
    swappedFromUnitCode: null,
    swappedFromProjectName: null,
    project: { name: "GREEN AVENUE" },
    client: {
      name: "Ahmed Ali",
      nationalId: "123",
      email: "a@example.com",
      ...baseClientFields,
      phones: [],
      addresses: [],
    },
    unitClients: [
      {
        role: "PRIMARY",
        client: {
          name: "Ahmed Ali",
          nationalId: "123",
          email: "a@example.com",
          phone1: "+20100000000",
          phone2: null,
          address1: "Cairo",
          address2: null,
          phones: [{ id: "p1", phone: "+20100000000", sortOrder: 0 }],
          addresses: [{ id: "a1", address: "Cairo", sortOrder: 0 }],
        },
      },
      {
        role: "CO_OWNER",
        client: {
          name: "Sara Ali",
          nationalId: "456",
          email: null,
          ...baseClientFields,
          phones: [],
          addresses: [],
        },
      },
    ],
    contractWorkflow: {
      contractDate: new Date("2024-01-15"),
      deliveryDate: new Date("2026-06-01"),
    },
    finishing: {
      finishingType: "FULLY_FINISHED",
      packageType: "PACKAGE_1",
      packageLabel: null,
      totalFinishingPrice: 500000,
      pricePerMeter: 4000,
      doorFees: 1000,
      aluminumFees: 2000,
      contractDate: new Date("2024-02-01"),
    },
  };

  it("fills merge fields for English", () => {
    const fields = buildOfficialDocumentMergeFields(unit, "en", {
      requestDescription: "Extend grace",
      issuedAt: new Date("2026-10-29T12:00:00Z"),
    });
    expect(fields.primaryOwnerName).toBe("Ahmed Ali");
    expect(fields.unitNumber).toBe("101");
    expect(fields.coOwner1Name).toBe("Sara Ali");
    expect(fields.projectName).toBe("GREEN AVENUE");

    const rendered = interpolateOfficialDocumentTemplate(
      "Owner {{primaryOwnerName}} unit {{unitCode}} — {{requestDescription}}",
      fields
    );
    expect(rendered).toContain("Ahmed Ali");
    expect(rendered).toContain("101-3-B");
    expect(rendered).toContain("Extend grace");
  });

  it("interpolates unknown keys as em dash", () => {
    const rendered = interpolateOfficialDocumentTemplate("{{unknownField}}", {});
    expect(rendered).toBe("—");
  });
});

describe("official-document permissions", () => {
  it("allows CS and management to generate", () => {
    expect(canGenerateOfficialDocuments("CS_AGENT")).toBe(true);
    expect(canGenerateOfficialDocuments("MANAGEMENT")).toBe(true);
    expect(canGenerateOfficialDocuments("OPERATIONS")).toBe(false);
  });

  it("allows operations to view only", () => {
    expect(canViewOfficialDocuments("OPERATIONS")).toBe(true);
    expect(canGenerateOfficialDocuments("OPERATIONS")).toBe(false);
  });

  it("restricts template editing to management", () => {
    expect(canEditOfficialDocumentTemplates("CS_AGENT")).toBe(false);
    expect(canEditOfficialDocumentTemplates("SUPER_ADMIN")).toBe(true);
  });
});

describe("official-document request binding", () => {
  it("maps document types to approved request types", () => {
    expect(requiredRequestTypeForDocument("GRACE_PERIOD_ANNEX")).toBe(
      "GRACE_PERIOD_ANNEX"
    );
    expect(requiredRequestTypeForDocument("HANDOVER_RECORD")).toBeNull();
  });
});
