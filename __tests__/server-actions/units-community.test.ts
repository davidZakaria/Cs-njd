import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Role } from "@prisma/client";

const mockAuth = vi.fn();
const mockPrismaUnit = {
  findUnique: vi.fn(),
};
const mockPrismaClient = {
  update: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unit: mockPrismaUnit,
    client: mockPrismaClient,
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

describe("updateUnit community management restrictions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseInput = {
    unitId: "unit-1",
    clientName: "Client A",
    phone1: "0100",
    phone2: "",
    email: "a@example.com",
    nationalId: "123",
    address1: "Street 1",
    address2: "",
    deliveryYear: "",
    gracePeriod: "",
    contractPricePerMeter: "",
    area: "",
    type: "APARTMENT" as const,
    unitCode: "A-1",
    agentId: "",
  };

  it("allows adding secondary phone when empty", async () => {
    mockAuth.mockResolvedValue(session("COMMUNITY_MANAGEMENT"));
    mockPrismaUnit.findUnique.mockResolvedValue({
      id: "unit-1",
      deletedAt: null,
      agentId: null,
      clientId: "client-1",
      client: {
        name: "Client A",
        phone1: "0100",
        phone2: null,
        email: "a@example.com",
        nationalId: "123",
        address1: "Street 1",
        address2: null,
      },
    });
    mockPrismaClient.update.mockResolvedValue({});

    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit({ ...baseInput, phone2: "0111" });

    expect(result.success).toBe(true);
    expect(mockPrismaClient.update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: { phone2: "0111", address2: null },
    });
  });

  it("rejects changing primary phone", async () => {
    mockAuth.mockResolvedValue(session("COMMUNITY_MANAGEMENT"));
    mockPrismaUnit.findUnique.mockResolvedValue({
      id: "unit-1",
      deletedAt: null,
      agentId: null,
      clientId: "client-1",
      client: {
        name: "Client A",
        phone1: "0100",
        phone2: null,
        email: "a@example.com",
        nationalId: "123",
        address1: "Street 1",
        address2: null,
      },
    });

    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit({ ...baseInput, phone1: "0999" });

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Cannot change primary phone number");
    expect(mockPrismaClient.update).not.toHaveBeenCalled();
  });

  it("rejects changing existing secondary phone", async () => {
    mockAuth.mockResolvedValue(session("COMMUNITY_MANAGEMENT"));
    mockPrismaUnit.findUnique.mockResolvedValue({
      id: "unit-1",
      deletedAt: null,
      agentId: null,
      clientId: "client-1",
      client: {
        name: "Client A",
        phone1: "0100",
        phone2: "0111",
        email: "a@example.com",
        nationalId: "123",
        address1: "Street 1",
        address2: "Street 2",
      },
    });

    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit({ ...baseInput, phone2: "0222", address2: "Street 2" });

    expect(result.success).toBe(false);
    expect(result).toHaveProperty(
      "error",
      "Cannot change or remove secondary phone number"
    );
  });
});
