import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const mockUpsertFinishing = vi.fn();
const mockUpsertWorkflow = vi.fn();
const mockApprovalCreate = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/audit/with-audit", () => ({
  withAudit: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/workflow/engineering-approval-log", () => ({
  recordUnitEngineeringApproval: (...args: unknown[]) =>
    mockApprovalCreate(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unit: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === "missing") return null;
        return {
          id: where.id,
          agentId: "agent-2",
          unitCode: "A-1",
          contractWorkflow: {
            siteVisitDone: false,
            siteVisitDate1: null,
            siteVisitDate2: null,
            siteVisitDate3: null,
          },
          finishing: {
            customModifications: "Kitchen snag",
            modificationsCompleted: false,
            currentFinishingStatus: null,
            phases: ["NOT_STARTED"],
          },
        };
      }),
    },
    contractWorkflow: {
      upsert: (...args: unknown[]) => mockUpsertWorkflow(...args),
    },
    finishing: {
      upsert: (...args: unknown[]) => mockUpsertFinishing(...args),
    },
  },
}));

describe("unit engineering approvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertWorkflow.mockResolvedValue({});
    mockUpsertFinishing.mockResolvedValue({});
    mockApprovalCreate.mockResolvedValue(undefined);
  });

  it("allows CS_AGENT site visit approval on any unit", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "cs-1", role: "CS_AGENT", name: "Agent" },
    });

    const { approveEngineeringSiteVisitAction } = await import(
      "@/lib/actions/unit-engineering-approvals"
    );
    const result = await approveEngineeringSiteVisitAction({
      unitId: "unit-1",
      siteVisitDone: true,
      siteVisitDate1: "2026-01-15",
      siteVisitDate2: null,
      siteVisitDate3: null,
    });

    expect(result.success).toBe(true);
    expect(mockUpsertWorkflow).toHaveBeenCalled();
    expect(mockApprovalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "SITE_VISIT_COMPLETION",
        approvedById: "cs-1",
      })
    );
  });

  it("denies OPERATIONS from engineering approvals", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "ops-1", role: "OPERATIONS", name: "Ops" },
    });

    const { approveEngineeringSnagDefectAction } = await import(
      "@/lib/actions/unit-engineering-approvals"
    );
    const result = await approveEngineeringSnagDefectAction({
      unitId: "unit-1",
    });

    expect(result.success).toBe(false);
    expect(mockUpsertFinishing).not.toHaveBeenCalled();
  });

  it("allows CS_AGENT snag/defect closure", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "cs-1", role: "CS_AGENT", name: "Agent" },
    });

    const { approveEngineeringSnagDefectAction } = await import(
      "@/lib/actions/unit-engineering-approvals"
    );
    const result = await approveEngineeringSnagDefectAction({
      unitId: "unit-1",
      note: "Snags cleared on site",
    });

    expect(result.success).toBe(true);
    expect(mockApprovalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "SNAG_DEFECT_CLOSURE" })
    );
  });
});
