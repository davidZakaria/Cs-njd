import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@prisma/client";

vi.mock("server-only", () => ({}));

const mockAuth = vi.fn();
const mockUnitFindUnique = vi.fn();
const mockUnitRequestCreate = vi.fn();
const mockRecordRequestAuditEvent = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unit: {
      findUnique: (...args: unknown[]) => mockUnitFindUnique(...args),
    },
    unitRequest: {
      create: (...args: unknown[]) => mockUnitRequestCreate(...args),
    },
  },
  activeUnitWhere: (where: Record<string, unknown>) => ({ ...where, deletedAt: null }),
}));

vi.mock("@/lib/requests/audit", () => ({
  recordRequestAuditEvent: (...args: unknown[]) =>
    mockRecordRequestAuditEvent(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("createUnitRequestAction primary clientId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "mgmt-1", role: "MANAGEMENT" as Role },
    });
    mockUnitRequestCreate.mockResolvedValue({ id: "req-new", type: "HANDOVER_APPOINTMENT" });
    mockRecordRequestAuditEvent.mockResolvedValue(undefined);
  });

  it("sets clientId from PRIMARY unitClient when legacy clientId is null", async () => {
    mockUnitFindUnique.mockResolvedValue({
      id: "unit-uc-only",
      clientId: null,
      deletedAt: null,
      unitClients: [{ role: "PRIMARY", clientId: "client-primary" }],
    });

    const { createUnitRequestAction } = await import("@/lib/actions/unit-requests");
    const result = await createUnitRequestAction({
      unitId: "unit-uc-only",
      type: "HANDOVER_APPOINTMENT",
      description: "Schedule handover",
    });

    expect(result).toEqual({ success: true, id: "req-new" });
    expect(mockUnitRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitId: "unit-uc-only",
          clientId: "client-primary",
          type: "HANDOVER_APPOINTMENT",
        }),
      })
    );
  });
});