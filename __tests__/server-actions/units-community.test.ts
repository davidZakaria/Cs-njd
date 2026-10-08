import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Role } from "@prisma/client";

const mockAuth = vi.fn();
const mockPrismaUnit = {
  findUnique: vi.fn(),
};
const mockPrismaClientPhone = {
  create: vi.fn(),
};
const mockPrismaClientAddress = {
  create: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unit: mockPrismaUnit,
    clientPhone: mockPrismaClientPhone,
    clientAddress: mockPrismaClientAddress,
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

const unitWithClient = {
  id: "unit-1",
  deletedAt: null,
  agentId: null,
  client: {
    id: "client-1",
    phone1: "0100",
    phone2: null,
    address1: "Street 1",
    address2: null,
    phones: [],
    addresses: [],
  },
};

describe("community client contact actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows community management to add an extra phone", async () => {
    mockAuth.mockResolvedValue(session("COMMUNITY_MANAGEMENT"));
    mockPrismaUnit.findUnique.mockResolvedValue(unitWithClient);
    mockPrismaClientPhone.create.mockResolvedValue({ id: "new-phone" });

    const { addClientExtraPhone } = await import("@/lib/actions/client-contacts");
    const result = await addClientExtraPhone("unit-1", "0111");

    expect(result.success).toBe(true);
    expect(mockPrismaClientPhone.create).toHaveBeenCalledWith({
      data: {
        clientId: "client-1",
        phone: "0111",
        sortOrder: 0,
      },
    });
  });

  it("denies community management from updateUnit", async () => {
    mockAuth.mockResolvedValue(session("COMMUNITY_MANAGEMENT"));

    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit({
      unitId: "unit-1",
      clientName: "Client",
      phone1: "0100",
      email: null,
      nationalId: null,
      address1: null,
      type: "APARTMENT",
    });

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Unauthorized");
  });

  it("rejects duplicate phone on add", async () => {
    mockAuth.mockResolvedValue(session("COMMUNITY_MANAGEMENT"));
    mockPrismaUnit.findUnique.mockResolvedValue({
      ...unitWithClient,
      client: {
        ...unitWithClient.client,
        phones: [{ id: "p1", phone: "0111", sortOrder: 0 }],
      },
    });

    const { addClientExtraPhone } = await import("@/lib/actions/client-contacts");
    const result = await addClientExtraPhone("unit-1", "0111");

    expect(result.success).toBe(false);
    expect(mockPrismaClientPhone.create).not.toHaveBeenCalled();
  });
});
