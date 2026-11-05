import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();
const mockTransaction = vi.fn();
const mockWriteGenerated = vi.fn();
const mockRecordAudit = vi.fn();
const mockRenderHandover = vi.fn();
const mockRenderGeneric = vi.fn();
const mockCompanyProfile = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/system/settings-store", () => ({
  getCompanyProfileSettings: () => mockCompanyProfile(),
}));

vi.mock("@/lib/official-documents/audit", () => ({
  recordOfficialDocumentAudit: (...args: unknown[]) => mockRecordAudit(...args),
}));

vi.mock("@/lib/official-documents/storage", () => ({
  buildGeneratedDocumentStoredFilename: () => "handover.pdf",
  writeGeneratedDocumentFile: (...args: unknown[]) => mockWriteGenerated(...args),
}));

vi.mock("@/lib/official-documents/handover/render-pdf", () => ({
  renderOfficialHandoverRecordPdf: (...args: unknown[]) => mockRenderHandover(...args),
}));

vi.mock("@/lib/official-documents/render-pdf", () => ({
  renderOfficialDocumentPdf: (...args: unknown[]) => mockRenderGeneric(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unit: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    officialDocumentTemplate: {
      findFirst: vi.fn().mockResolvedValue({
        id: "tpl-ar",
        title: "محضر التسليم",
        body: "placeholder",
        version: 1,
        locale: "ar",
      }),
    },
    officialDocumentTextDraft: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    officialDocumentTextDraftVersion: {
      create: (...args: unknown[]) => mockCreate(...args),
      findFirst: vi.fn(async (args: { where?: { draftId?: string } }) => {
        if (args?.where?.draftId === "draft-legacy-en") {
          return {
            id: "v0",
            body: "Unit Handover Record\n\nProject: GREEN AVENUE",
            createdAt: new Date(),
            draftId: "draft-legacy-en",
          };
        }
        if (args?.where?.draftId === "draft-legacy") {
          return {
            id: "v1",
            body: "محضr — LEGAL saved version",
            createdAt: new Date(),
            draftId: "draft-legacy",
          };
        }
        if (args?.where?.draftId === "draft-edited") {
          return {
            id: "v2",
            body: "محضr official text\n\nLEGAL_EDIT_MARKER: approved clause",
            createdAt: new Date(),
            draftId: "draft-edited",
          };
        }
        if (args?.where?.draftId === "draft-ar") {
          return {
            id: "v3",
            body: "محضr تسليم — بيانات",
            createdAt: new Date(),
            draftId: "draft-ar",
          };
        }
        return null;
      }),
    },
    unitGeneratedDocument: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    unitRequest: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

const greenUnitRow = {
  id: "unit-green",
  unitCode: "762-0-X",
  area: 220,
  gracePeriod: "0",
  contractPricePerMeter: 0,
  swapOutgoingUnitCode: null,
  swapOutgoingProjectName: null,
  swappedFromUnitCode: null,
  swappedFromProjectName: null,
  project: { name: "GREEN AVENUE", unitCycleEnabled: true },
  client: {
    name: "Owner One",
    nationalId: "26309100200715",
    email: "owner@example.com",
    phone1: "+12000000000",
    phone2: null,
    address1: "Sample Street",
    address2: null,
    phones: [{ id: "p1", phone: "+12000000000", sortOrder: 0 }],
    addresses: [{ id: "a1", address: "Sample Street", sortOrder: 0 }],
  },
  unitClients: [
    {
      role: "PRIMARY",
      position: 0,
      client: {
        name: "Owner One",
        nationalId: "26309100200715",
        email: "owner@example.com",
        phone1: "+12000000000",
        phone2: null,
        address1: "Sample Street",
        address2: null,
        phones: [{ id: "p1", phone: "+12000000000", sortOrder: 0 }],
        addresses: [{ id: "a1", address: "Sample Street", sortOrder: 0 }],
      },
    },
  ],
  contractWorkflow: {
    contractDate: new Date("2025-09-30"),
    deliveryDate: new Date("2026-05-17"),
  },
  finishing: {
    finishingType: "FULLY_FINISHED",
    packageType: "PACKAGE_1",
    packageLabel: "Fully Finished",
    totalFinishingPrice: 100,
    pricePerMeter: 1,
    doorFees: null,
    aluminumFees: null,
    contractDate: null,
  },
};

describe("generateOfficialDocumentAction handover integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "legal-1", role: "LEGAL" } });
    mockCompanyProfile.mockResolvedValue({ address: "HQ" });
    mockRenderHandover.mockResolvedValue(fakePdf);
    mockRenderGeneric.mockResolvedValue(fakePdf);
    mockWriteGenerated.mockResolvedValue(undefined);
    mockRecordAudit.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue({ id: "doc-1" });
    mockUpdate.mockResolvedValue({});
    mockTransaction.mockImplementation(async (fn) =>
      fn({
        officialDocumentTextDraft: { update: mockUpdate },
        officialDocumentTextDraftVersion: { create: mockCreate },
      })
    );
  });

  it("uses Chromium with saved draft body for official handover after metadata sync", async () => {
    const officialBody =
      "محضر تسليم — أولاً: بيانات المستلم\n\nLEGAL_EDIT_MARKER in saved version";
    mockFindFirst.mockImplementation(async (args: { where?: { id?: string } }) => {
      if (args?.where?.id === "draft-legacy") {
        return {
          id: "draft-legacy",
          unitId: "unit-green",
          documentType: "HANDOVER_RECORD",
          templateLocale: "en",
          handoverTemplateKey: null,
          currentBody: "Unit Handover Record\n\nProject: GREEN AVENUE",
          unitRequestId: null,
          templateId: "tpl-en",
          templateVersion: 1,
          title: "Handover Record",
          versions: [{ id: "v1", body: officialBody, createdAt: new Date() }],
        };
      }
      return greenUnitRow;
    });

    const { generateOfficialDocumentAction } = await import(
      "@/lib/actions/official-documents"
    );

    const result = await generateOfficialDocumentAction({
      unitId: "unit-green",
      textDraftId: "draft-legacy",
    });

    expect(result.success).toBe(true);
    expect(mockRenderHandover).toHaveBeenCalledTimes(1);
    expect(mockRenderGeneric).not.toHaveBeenCalled();
    expect(mockRenderHandover.mock.calls[0]?.[0]?.templateKey).toBe(
      "green-avenue-no-insurance"
    );
    expect(mockRenderHandover.mock.calls[0]?.[0]?.draftBody).toContain("LEGAL saved version");
  });

  it("passes saved draft body including legal edit markers to the Chromium renderer", async () => {
    const bodyWithMarker =
      "محضr official text\n\nLEGAL_EDIT_MARKER: approved clause";
    mockFindFirst.mockImplementation(async (args: { where?: { id?: string } }) => {
      if (args?.where?.id === "draft-edited") {
        return {
          id: "draft-edited",
          unitId: "unit-green",
          documentType: "HANDOVER_RECORD",
          templateLocale: "ar",
          handoverTemplateKey: "green-avenue",
          currentBody: bodyWithMarker,
          unitRequestId: null,
          templateId: "tpl-ar",
          templateVersion: 1,
          title: "محضr",
          versions: [{ id: "v1", body: bodyWithMarker, createdAt: new Date() }],
        };
      }
      return greenUnitRow;
    });
    mockUpdate.mockResolvedValue({});

    const { generateOfficialDocumentAction } = await import(
      "@/lib/actions/official-documents"
    );

    const result = await generateOfficialDocumentAction({
      unitId: "unit-green",
      textDraftId: "draft-edited",
    });

    expect(result.success).toBe(true);
    expect(mockRenderHandover.mock.calls[0]?.[0]?.draftBody).toContain(
      "LEGAL_EDIT_MARKER"
    );
  });

  it("blocks generate while legacy English placeholder remains in saved version", async () => {
    mockFindFirst.mockImplementation(async (args: { where?: { id?: string } }) => {
      if (args?.where?.id === "draft-legacy-en") {
        return {
          id: "draft-legacy-en",
          unitId: "unit-green",
          documentType: "HANDOVER_RECORD",
          templateLocale: "ar",
          handoverTemplateKey: "green-avenue",
          currentBody: "Unit Handover Record\n\nProject: GREEN AVENUE",
          unitRequestId: null,
          templateId: "tpl-ar",
          templateVersion: 1,
          title: "محضر",
          versions: [],
        };
      }
      return greenUnitRow;
    });

    const { generateOfficialDocumentAction } = await import(
      "@/lib/actions/official-documents"
    );

    const result = await generateOfficialDocumentAction({
      unitId: "unit-green",
      textDraftId: "draft-legacy-en",
    });

    expect(result.success).toBe(false);
    expect(mockRenderHandover).not.toHaveBeenCalled();
  });

  it("does not silently fall back to generic pdf-lib when Chromium handover render throws", async () => {
    mockRenderHandover.mockRejectedValue(new Error("playwright missing"));
    mockFindFirst.mockImplementation(async (args: { where?: { id?: string } }) => {
      if (args?.where?.id === "draft-ar") {
        return {
          id: "draft-ar",
          unitId: "unit-green",
          documentType: "HANDOVER_RECORD",
          templateLocale: "ar",
          handoverTemplateKey: "green-avenue",
          currentBody: "محضر تسليم — بيانات",
          unitRequestId: null,
          templateId: "tpl-ar",
          templateVersion: 1,
          title: "محضر",
          versions: [{ id: "v1", body: "محضr تسليم — بيانات", createdAt: new Date() }],
        };
      }
      return greenUnitRow;
    });

    const { generateOfficialDocumentAction } = await import(
      "@/lib/actions/official-documents"
    );

    const result = await generateOfficialDocumentAction({
      unitId: "unit-green",
      textDraftId: "draft-ar",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Chromium");
    }
    expect(mockRenderGeneric).not.toHaveBeenCalled();
  });
});
