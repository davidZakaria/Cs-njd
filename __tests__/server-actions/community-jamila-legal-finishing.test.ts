import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@prisma/client";

const mockAuth = vi.fn();
const mockPrismaUnit = { findUnique: vi.fn() };
const mockPrismaContractWorkflow = { upsert: vi.fn() };
const mockPrismaFinishing = { upsert: vi.fn() };

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unit: mockPrismaUnit,
    contractWorkflow: mockPrismaContractWorkflow,
    finishing: mockPrismaFinishing,
  },
  auditContext: {
    run: <T>(_ctx: unknown, fn: () => T) => fn(),
  },
}));

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve({
      get: () => "127.0.0.1",
    }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function session(role: Role) {
  return {
    user: {
      id: "community-1",
      email: "community@test.com",
      name: "Community User",
      role,
    },
  };
}

const jamilaProject = { id: "proj-jamila", name: "JAMILA NORTH COAST" };
const greenProject = { id: "proj-ga", name: "GREEN AVENUE" };

const handoverInput = {
  unitId: "unit-1",
  handoverStatus: "PENDING" as const,
  actionLabel: "",
  contractDate: null,
  deliveryDate: null,
  hasPreliminarySaleContract: false,
  hasSignedProtocol: true,
  signedProtocolDate: null,
  hasSignedExtension: false,
  signedExtensionDate: null,
  hasFinalSaleContract: false,
  finalSaleContractDate: null,
  hasPaidFees: false,
  papersReceived: false,
  powerOfAttorneyReceived: false,
  isLegallyBlocked: false,
  inspectionDate: null,
  siteVisitDone: false,
  siteVisitDate1: null,
  siteVisitDate2: null,
  siteVisitDate3: null,
  clientInspectionNotes: "",
  dhlSentToClient: false,
  dhlSentToClientDate: null,
  dhlReceivedFromClient: false,
  dhlReceivedFromClientDate: null,
  paperHandoverPreliminaryCopy: false,
  paperHandoverOriginalProtocol: false,
  paperHandoverFinishingPapers: false,
  paperHandoverKeyReceived: false,
};

const finishingInput = {
  unitId: "unit-1",
  packageType: null,
  executingCompany: null,
  contractDate: null,
  datedAt: null,
  emailDate: null,
  pricePerMeter: null,
  totalFinishingPrice: 120000,
  doorFees: null,
  aluminumFees: null,
  phases: ["NOT_STARTED" as const],
  currentFinishingStatus: null,
  customModifications: null,
  modificationsCompleted: true,
};

describe("community Jamila legal & finishing mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaContractWorkflow.upsert.mockResolvedValue({});
    mockPrismaFinishing.upsert.mockResolvedValue({});
  });

  it("allows community to update handover on Jamila units", async () => {
    mockAuth.mockResolvedValue(session("COMMUNITY_MANAGEMENT"));
    mockPrismaUnit.findUnique.mockResolvedValue({
      id: "unit-1",
      agentId: null,
      project: jamilaProject,
      contractWorkflow: null,
    });

    const { updateHandoverChecklist } = await import("@/lib/actions/crm");
    const result = await updateHandoverChecklist(handoverInput);

    expect(result.success).toBe(true);
    expect(mockPrismaContractWorkflow.upsert).toHaveBeenCalled();
  });

  it("forbids community handover updates on non-Jamila units", async () => {
    mockAuth.mockResolvedValue(session("COMMUNITY_MANAGEMENT"));
    mockPrismaUnit.findUnique.mockResolvedValue({
      id: "unit-1",
      agentId: null,
      project: greenProject,
      contractWorkflow: null,
    });

    const { updateHandoverChecklist } = await import("@/lib/actions/crm");
    const result = await updateHandoverChecklist(handoverInput);

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Forbidden");
    expect(mockPrismaContractWorkflow.upsert).not.toHaveBeenCalled();
  });

  it("allows community to update finishing on Jamila units", async () => {
    mockAuth.mockResolvedValue(session("COMMUNITY_MANAGEMENT"));
    mockPrismaUnit.findUnique.mockResolvedValue({
      id: "unit-1",
      agentId: null,
      project: jamilaProject,
    });

    const { updateFinishing } = await import("@/lib/actions/crm");
    const result = await updateFinishing(finishingInput);

    expect(result.success).toBe(true);
    expect(mockPrismaFinishing.upsert).toHaveBeenCalled();
  });

  it("forbids community finishing updates on non-Jamila units", async () => {
    mockAuth.mockResolvedValue(session("COMMUNITY_MANAGEMENT"));
    mockPrismaUnit.findUnique.mockResolvedValue({
      id: "unit-1",
      agentId: null,
      project: greenProject,
    });

    const { updateFinishing } = await import("@/lib/actions/crm");
    const result = await updateFinishing(finishingInput);

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Unauthorized");
    expect(mockPrismaFinishing.upsert).not.toHaveBeenCalled();
  });
});
