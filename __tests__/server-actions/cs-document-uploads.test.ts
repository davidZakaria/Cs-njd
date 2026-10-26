import { describe, expect, it, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockWrite = vi.fn();
const mockDelete = vi.fn();
const mockRecordAudit = vi.fn();
const mockAuditContext = { getStore: vi.fn(() => ({ userId: "user-cs" })) };

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unit: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    finishing: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    contractWorkflow: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
  basePrisma: {
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma/audit-context", () => ({
  auditContext: mockAuditContext,
}));

vi.mock("@/lib/prisma/record-audit-log", () => ({
  recordAuditLog: (...args: unknown[]) => mockRecordAudit(...args),
}));

vi.mock("@/lib/audit/with-audit", () => ({
  withAudit: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("@/lib/uploads/unit-document-storage", () => ({
  UNIT_DOCUMENT_MAX_BYTES: 15 * 1024 * 1024,
  buildUnitDocumentStoredFilename: () => "unit_file.pdf",
  writeUnitDocumentFile: (...args: unknown[]) => mockWrite(...args),
  deleteUnitDocumentFile: (...args: unknown[]) => mockDelete(...args),
  isAllowedUnitDocumentMime: (mime: string) => mime === "application/pdf",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function pdfFile() {
  return new File(["x"], "scan.pdf", { type: "application/pdf" });
}

const unitBase = {
  id: "unit-1",
  agentId: "other-agent",
  contractWorkflow: { extensionAnnexFile: null, signedContractFile: null },
  finishing: { finishingContractFile: null },
};

describe("CS portfolio document uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(unitBase);
    mockUpsert.mockResolvedValue({});
    mockWrite.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
  });

  it("allows CS agent to upload grace period annex on unassigned unit", async () => {
    mockAuth.mockResolvedValue({ user: { id: "cs-1", role: "CS_AGENT" } });
    const { uploadUnitDocument } = await import("@/lib/actions/unit-documents");

    const formData = new FormData();
    formData.append("unitId", "unit-1");
    formData.append("documentType", "extensionAnnex");
    formData.append("file", pdfFile());

    const result = await uploadUnitDocument(formData);
    expect(result.success).toBe(true);
    expect(mockWrite).toHaveBeenCalled();
    expect(mockRecordAudit).toHaveBeenCalled();
  });

  it("blocks CS agent from replacing an existing grace period annex", async () => {
    mockAuth.mockResolvedValue({ user: { id: "cs-1", role: "CS_AGENT" } });
    mockFindUnique.mockResolvedValue({
      ...unitBase,
      contractWorkflow: { extensionAnnexFile: "old.pdf", signedContractFile: null },
    });
    const { uploadUnitDocument } = await import("@/lib/actions/unit-documents");

    const formData = new FormData();
    formData.append("unitId", "unit-1");
    formData.append("documentType", "extensionAnnex");
    formData.append("file", pdfFile());

    const result = await uploadUnitDocument(formData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("management");
    }
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("allows management to replace finishing contract", async () => {
    mockAuth.mockResolvedValue({ user: { id: "mgr-1", role: "MANAGEMENT" } });
    mockFindUnique.mockResolvedValue({
      ...unitBase,
      finishing: { finishingContractFile: "old.pdf" },
    });
    const { uploadUnitDocument } = await import("@/lib/actions/unit-documents");

    const formData = new FormData();
    formData.append("unitId", "unit-1");
    formData.append("documentType", "finishingContract");
    formData.append("file", pdfFile());

    const result = await uploadUnitDocument(formData);
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("blocks CS agent from removing grace period annex", async () => {
    mockAuth.mockResolvedValue({ user: { id: "cs-1", role: "CS_AGENT" } });
    mockFindUnique.mockResolvedValue({
      ...unitBase,
      contractWorkflow: { extensionAnnexFile: "old.pdf", signedContractFile: null },
    });
    const { removeUnitDocument } = await import("@/lib/actions/unit-documents");

    const result = await removeUnitDocument("unit-1", "extensionAnnex");
    expect(result.success).toBe(false);
  });
});
