import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Role, UnitType } from "@prisma/client";

const mockAuth = vi.fn();
const mockClientUpdate = vi.fn();
const mockUnitFindUnique = vi.fn();
const mockClientPhoneFindMany = vi.fn();
const mockClientAddressFindMany = vi.fn();

const mockTx = {
  unit: { update: vi.fn(), findUnique: vi.fn() },
  client: { update: mockClientUpdate, create: vi.fn() },
  clientPhone: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  clientAddress: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
    clientPhone: {
      findMany: (...args: unknown[]) => mockClientPhoneFindMany(...args),
    },
    clientAddress: {
      findMany: (...args: unknown[]) => mockClientAddressFindMany(...args),
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
  project: { id: "project-1", name: "GREEN AVENUE" },
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

describe("updateUnit — CS_AGENT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(csSession());
    mockUnitFindUnique.mockResolvedValue(baseUnit);
    mockClientUpdate.mockResolvedValue({});
    mockClientPhoneFindMany.mockResolvedValue([]);
    mockClientAddressFindMany.mockResolvedValue([]);
  });

  it("updates phone, address, and identity on any unit", async () => {
    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit(
      validCsInput({
        clientName: "Updated Name",
        email: "new@test.com",
        nationalId: "456",
        phone1: "0111",
        address1: "New street",
      })
    );

    expect(result.success).toBe(true);
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: expect.objectContaining({
        name: "Updated Name",
        email: "new@test.com",
        nationalId: "456",
        phone1: "0111",
        address1: "New street",
      }),
    });
  });

  it("rejects blanking an existing client name", async () => {
    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit(
      validCsInput({
        clientName: "   ",
      })
    );

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Client name cannot be cleared");
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("rejects clearing an existing email", async () => {
    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit(
      validCsInput({
        email: null,
      })
    );

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Email cannot be cleared");
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("rejects blanking an existing national ID", async () => {
    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit(
      validCsInput({
        nationalId: null,
      })
    );

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "National ID cannot be cleared");
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("allows phone updates when stored identity was already empty", async () => {
    mockUnitFindUnique.mockResolvedValue({
      ...baseUnit,
      client: client({ name: "", email: "", nationalId: "" }),
    });

    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit(
      validCsInput({
        clientName: "New legal name",
        email: null,
        nationalId: null,
        phone1: "0111",
      })
    );

    expect(result.success).toBe(true);
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: expect.objectContaining({
        name: "New legal name",
        email: null,
        nationalId: null,
        phone1: "0111",
      }),
    });
  });

  it("does not delete omitted extra phones on save", async () => {
    mockClientPhoneFindMany.mockResolvedValue([
      { id: "phone-extra", phone: "0111", sortOrder: 0, clientId: "client-1" },
    ]);
    mockTx.clientPhone.findMany.mockResolvedValue([
      { id: "phone-extra", phone: "0111", sortOrder: 0, clientId: "client-1" },
    ]);

    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit(validCsInput({ extraPhones: [] }));

    expect(result.success).toBe(true);
    expect(mockTx.clientPhone.delete).not.toHaveBeenCalled();
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
