import { describe, expect, it, vi, beforeEach } from "vitest";
import type { UnitRequest, UnitRequestType, UnitRequestStatus, Role } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unitRequest: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    requestAuditEvent: {
      create: vi.fn(),
    },
  },
  basePrisma: {
    unitRequest: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
  activeUnitWhere: () => ({}),
  notDeleted: { deletedAt: null },
}));

vi.mock("@/lib/requests/audit", () => ({
  recordRequestAuditEvent: vi.fn(),
}));

const { updateUnitRequestDescriptionAction } = await import(
  "@/lib/actions/unit-requests"
);

describe("unit requests two-owner scenarios", () => {
  beforeEach(() => {
    mockAuth.mockClear();
    mockFindUnique.mockClear();
    mockFindMany.mockClear();
    mockUpdate.mockClear();
    mockCreate.mockClear();
  });

  it("allows editing a request description on a two-owner unit", async () => {
    const twoOwnerRequest = {
      id: "req-two-owner",
      type: "HANDOVER_APPOINTMENT" as UnitRequestType,
      status: "PENDING" as UnitRequestStatus,
      requestedById: "agent-1",
      description: "Original description",
      unitId: "unit-with-two-owners",
      deletedAt: null,
    };

    mockAuth.mockResolvedValue({
      user: { id: "agent-1", role: "CS_AGENT" as Role },
    });

    mockFindUnique.mockResolvedValue(twoOwnerRequest);
    mockUpdate.mockResolvedValue({
      ...twoOwnerRequest,
      description: "Updated description for two-owner unit",
    });

    const result = await updateUnitRequestDescriptionAction({
      requestId: "req-two-owner",
      description: "Updated description for two-owner unit",
    });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "req-two-owner" },
      data: { description: "Updated description for two-owner unit" },
    });
  });

  it("allows management to edit a request on a two-owner unit they did not create", async () => {
    const twoOwnerRequest = {
      id: "req-two-owner",
      type: "HANDOVER_APPOINTMENT" as UnitRequestType,
      status: "PENDING" as UnitRequestStatus,
      requestedById: "agent-1",
      description: "Original description",
      unitId: "unit-with-two-owners",
      deletedAt: null,
    };

    mockAuth.mockResolvedValue({
      user: { id: "mgmt-user", role: "MANAGEMENT" as Role },
    });

    mockFindUnique.mockResolvedValue(twoOwnerRequest);
    mockUpdate.mockResolvedValue({
      ...twoOwnerRequest,
      description: "Management edit on two-owner unit",
    });

    const result = await updateUnitRequestDescriptionAction({
      requestId: "req-two-owner",
      description: "Management edit on two-owner unit",
    });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("prevents editing a deleted request on a two-owner unit", async () => {
    const deletedRequest = {
      id: "req-deleted",
      type: "HANDOVER_APPOINTMENT" as UnitRequestType,
      status: "PENDING" as UnitRequestStatus,
      requestedById: "agent-1",
      description: "Deleted request",
      unitId: "unit-with-two-owners",
      deletedAt: new Date(),
    };

    mockAuth.mockResolvedValue({
      user: { id: "agent-1", role: "CS_AGENT" as Role },
    });

    mockFindUnique.mockResolvedValue(deletedRequest);

    const result = await updateUnitRequestDescriptionAction({
      requestId: "req-deleted",
      description: "Should not update",
    });

    expect(result.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
