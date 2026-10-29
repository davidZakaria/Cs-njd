import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/audit/with-audit", () => ({
  withAudit: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unit: {
      findUnique: vi.fn(async () => ({ id: "unit-1" })),
    },
    contractWorkflow: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

describe("updateOperationsArchiveFiling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({});
  });

  it("allows OPERATIONS to toggle papersReceived", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "ops-1", role: "OPERATIONS", name: "Ops" },
    });

    const { updateOperationsArchiveFiling } = await import("@/lib/actions/crm");
    const result = await updateOperationsArchiveFiling({
      unitId: "unit-1",
      papersReceived: true,
    });

    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId: "unit-1" },
        update: { papersReceived: true },
      })
    );
  });

  it("denies CS_AGENT from toggling archive filing", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "cs-1", role: "CS_AGENT", name: "Agent" },
    });

    const { updateOperationsArchiveFiling } = await import("@/lib/actions/crm");
    const result = await updateOperationsArchiveFiling({
      unitId: "unit-1",
      papersReceived: true,
    });

    expect(result.success).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
