import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role, UnitType } from "@prisma/client";

import {
  recordAuditRowIfContext,
  runWithAsyncAuditContext,
  type SimulatedAuditRow,
} from "../helpers/async-audit-context";

const mockAuth = vi.fn();
const auditRows: SimulatedAuditRow[] = [];

const mockClientUpdate = vi.fn();
const mockUnitFindUnique = vi.fn();

const mockTx = {
  client: { update: mockClientUpdate },
  clientPhone: {
    findMany: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  clientAddress: {
    findMany: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
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
    run: runWithAsyncAuditContext,
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

const unitType: UnitType = "APARTMENT";

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

const baseUnit = {
  id: "unit-1",
  deletedAt: null,
  projectId: "project-1",
  unitCode: "A-101",
  clientId: "client-1",
  agentId: "cs-agent-1",
  client: {
    id: "client-1",
    name: "Client Name",
    phone1: "0100",
    email: "client@test.com",
    nationalId: "123",
    address1: "Street 1",
  },
};

describe("updateUnit contact removal audit context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditRows.length = 0;
    mockAuth.mockResolvedValue(csSession());
    mockUnitFindUnique.mockResolvedValue(baseUnit);
    mockClientUpdate.mockResolvedValue({});

    mockTx.clientPhone.delete.mockImplementation(async () => {
      recordAuditRowIfContext("ClientPhone", "DELETE", auditRows);
    });
    mockTx.clientAddress.delete.mockImplementation(async () => {
      recordAuditRowIfContext("ClientAddress", "DELETE", auditRows);
    });
  });

  it("records audit context when an extra phone is removed from the profile", async () => {
    mockTx.clientPhone.findMany.mockResolvedValue([
      { id: "phone-extra", phone: "0111", sortOrder: 0, clientId: "client-1" },
    ]);
    mockTx.clientAddress.findMany.mockResolvedValue([]);

    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit({
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
    });

    expect(result.success).toBe(true);
    expect(mockTx.clientPhone.delete).toHaveBeenCalledWith({
      where: { id: "phone-extra" },
    });
    expect(auditRows).toContainEqual({
      userId: "cs-agent-1",
      tableName: "ClientPhone",
      action: "DELETE",
    });
  });

  it("records audit context when an extra address is removed from the profile", async () => {
    mockTx.clientPhone.findMany.mockResolvedValue([]);
    mockTx.clientAddress.findMany.mockResolvedValue([
      {
        id: "address-extra",
        address: "Extra street",
        sortOrder: 0,
        clientId: "client-1",
      },
    ]);

    const { updateUnit } = await import("@/lib/actions/units");
    const result = await updateUnit({
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
    });

    expect(result.success).toBe(true);
    expect(mockTx.clientAddress.delete).toHaveBeenCalledWith({
      where: { id: "address-extra" },
    });
    expect(auditRows).toContainEqual({
      userId: "cs-agent-1",
      tableName: "ClientAddress",
      action: "DELETE",
    });
  });
});
