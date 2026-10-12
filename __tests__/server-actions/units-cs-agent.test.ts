import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Role, UnitType } from "@prisma/client";

const mockAuth = vi.fn();
const mockClientUpdate = vi.fn();
const mockUnitFindUnique = vi.fn();

const mockTx = {
  unit: { update: vi.fn(), findUnique: vi.fn() },
  client: { update: mockClientUpdate, create: vi.fn() },
  clientPhone: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  clientAddress: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unit: {
      findUnique: (...args: unknown[]) => mockUnitFindUnique(...args),
    },
    $transaction: (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx),
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

function csSession() {
  return {
    user: {
      id: "cs-agent-1",
      email: "cs@test.com",
      name: "CS Agent",
      role: "CS_AGENT" as Role,
    },
  };
}

const unitType: UnitType = "APARTMENT";

function client(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    name: "Client Name",
    phone1: "0100",
    email: "client@test.com",
    nationalId: "123",
    address1: "Street 1",
    ...overrides,
  };
}

const baseUnit = {
  id: "unit-1",
  deletedAt: null,
  projectId: "project-1",
  unitCode: "A-101",
  clientId: "client-1",
  agentId: "other-agent",
  client: client(),
};

function validCsInput(overrides: Record<string, unknown> = {}) {
  return {
    unitId: "unit-1",
    clientName: "Client Name",
    phone1: "0100",
    email: "client@test.com",
    nationalId: "123",
    address1: "Street 1",
    type: unitType,
    unitCode: "A-101",
    extraPhones: [],
    extraAddresses: [],
    ...overrides,
  };
}

describe("updateUnit — CS_AGENT phone/address only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(csSession());
    mockUnitFindUnique.mockResolvedValue(baseUnit);
    mockClientUpdate.mockResolvedValue({});
  });

  it("updates phone and address on any unit", async () => {
    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit(
      validCsInput({
        phone1: "0111",
        address1: "New street",
      })
    );

    expect(result.success).toBe(true);
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: expect.objectContaining({
        name: "Client Name",
        email: "client@test.com",
        nationalId: "123",
        phone1: "0111",
        address1: "New street",
      }),
    });
  });

  it("succeeds when stored email and national ID are empty strings", async () => {
    mockUnitFindUnique.mockResolvedValue({
      ...baseUnit,
      client: client({ email: "", nationalId: "" }),
    });

    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit(
      validCsInput({
        email: null,
        nationalId: null,
        phone1: "0111",
      })
    );

    expect(result.success).toBe(true);
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: expect.objectContaining({
        email: "",
        nationalId: "",
        phone1: "0111",
      }),
    });
  });

  it("succeeds with padded or invalid stored identity values in the database", async () => {
    mockUnitFindUnique.mockResolvedValue({
      ...baseUnit,
      client: client({
        name: "",
        email: "  N/A  ",
        nationalId: "  ",
      }),
    });

    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit(
      validCsInput({
        clientName: "",
        email: "N/A",
        nationalId: "",
        phone1: "0999",
      })
    );

    expect(result.success).toBe(true);
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: expect.objectContaining({
        name: "",
        email: "  N/A  ",
        nationalId: "  ",
        phone1: "0999",
      }),
    });
  });

  it("ignores tampered identity fields and keeps stored values", async () => {
    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit(
      validCsInput({
        clientName: "Hacked Name",
        email: "hacker@test.com",
        nationalId: "999",
        phone1: "0111",
      })
    );

    expect(result.success).toBe(true);
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: expect.objectContaining({
        name: "Client Name",
        email: "client@test.com",
        nationalId: "123",
        phone1: "0111",
      }),
    });
  });

  it("rejects units without a client record", async () => {
    mockUnitFindUnique.mockResolvedValue({
      ...baseUnit,
      clientId: null,
      client: null,
    });

    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit(validCsInput());

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Client record not found");
  });
});
