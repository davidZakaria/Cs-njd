import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Role } from "@prisma/client";

const mockAuth = vi.fn();
const mockUnitFindUnique = vi.fn();
const mockUnitClientFindUnique = vi.fn();
const mockUnitClientDelete = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unit: { findUnique: mockUnitFindUnique },
    unitClient: {
      findUnique: mockUnitClientFindUnique,
      delete: mockUnitClientDelete,
    },
    $transaction: mockTransaction,
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

const jamilaProject = { id: "proj-jamila", name: "JAMILA NORTH COAST" };

function session(role: Role) {
  return {
    user: {
      id: "user-1",
      email: "test@test.com",
      name: "Test",
      role,
    },
  };
}

describe("unit co-owner actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        unitClient: {
          findUnique: mockUnitClientFindUnique,
          delete: mockUnitClientDelete,
        },
      })
    );
  });

  it("allows management to remove a co-owner", async () => {
    mockAuth.mockResolvedValue(session("MANAGEMENT"));
    mockUnitFindUnique.mockResolvedValue({
      id: "unit-1",
      deletedAt: null,
      clientId: "primary-client",
      project: jamilaProject,
      unitClients: [
        { id: "link-1", clientId: "co-1", role: "CO_OWNER", position: 1 },
      ],
    });
    mockUnitClientFindUnique.mockResolvedValue({
      id: "link-1",
      role: "CO_OWNER",
    });
    mockUnitClientDelete.mockResolvedValue({});

    const { removeUnitCoOwner } = await import("@/lib/actions/unit-clients");
    const result = await removeUnitCoOwner("unit-1", "co-1");

    expect(result.success).toBe(true);
    expect(mockUnitClientDelete).toHaveBeenCalled();
  });

  it("denies CS agent from removing co-owners", async () => {
    mockAuth.mockResolvedValue(session("CS_AGENT"));
    mockUnitFindUnique.mockResolvedValue({
      id: "unit-1",
      deletedAt: null,
      clientId: "primary-client",
      project: jamilaProject,
      unitClients: [],
    });

    const { removeUnitCoOwner } = await import("@/lib/actions/unit-clients");
    const result = await removeUnitCoOwner("unit-1", "co-1");

    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Unauthorized");
    expect(mockUnitClientDelete).not.toHaveBeenCalled();
  });

  it("denies removing the primary owner", async () => {
    mockAuth.mockResolvedValue(session("MANAGEMENT"));
    mockUnitFindUnique.mockResolvedValue({
      id: "unit-1",
      deletedAt: null,
      clientId: "primary-client",
      project: jamilaProject,
      unitClients: [],
    });

    const { removeUnitCoOwner } = await import("@/lib/actions/unit-clients");
    const result = await removeUnitCoOwner("unit-1", "primary-client");

    expect(result.success).toBe(false);
    expect(mockUnitClientDelete).not.toHaveBeenCalled();
  });

  it("allows CS agent to add a new co-owner but not link existing", async () => {
    mockAuth.mockResolvedValue(session("CS_AGENT"));
    mockUnitFindUnique.mockResolvedValue({
      id: "unit-1",
      deletedAt: null,
      clientId: "primary-client",
      project: { id: "proj-ga", name: "GREEN AVENUE" },
      unitClients: [],
    });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        client: {
          create: vi.fn().mockResolvedValue({ id: "new-co" }),
        },
        unitClient: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "link-new" }),
        },
      })
    );

    const { addUnitCoOwner } = await import("@/lib/actions/unit-clients");
    const addResult = await addUnitCoOwner({
      unitId: "unit-1",
      mode: "new",
      name: "Second Owner",
    });
    expect(addResult.success).toBe(true);

    const linkResult = await addUnitCoOwner({
      unitId: "unit-1",
      mode: "link",
      existingClientId: "other-client",
    });
    expect(linkResult.success).toBe(false);
    expect(linkResult).toHaveProperty("error", "Unauthorized");
  });

  it("stores optional email and address1 when creating a new co-owner client", async () => {
    const mockClientCreate = vi.fn().mockResolvedValue({ id: "new-co" });
    mockAuth.mockResolvedValue(session("MANAGEMENT"));
    mockUnitFindUnique.mockResolvedValue({
      id: "unit-1",
      deletedAt: null,
      clientId: "primary-client",
      project: jamilaProject,
      unitClients: [],
    });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        client: { create: mockClientCreate },
        unitClient: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "link-new" }),
        },
      })
    );

    const { addUnitCoOwner } = await import("@/lib/actions/unit-clients");
    const result = await addUnitCoOwner({
      unitId: "unit-1",
      mode: "new",
      name: "Second Owner",
      email: "owner@example.com",
      address: "  12 Nile Street  ",
    });

    expect(result.success).toBe(true);
    expect(mockClientCreate).toHaveBeenCalledWith({
      data: {
        name: "Second Owner",
        nationalId: null,
        phone1: null,
        email: "owner@example.com",
        address1: "12 Nile Street",
      },
    });
  });

  it("trims email before validating and storing", async () => {
    const mockClientCreate = vi.fn().mockResolvedValue({ id: "new-co" });
    mockAuth.mockResolvedValue(session("MANAGEMENT"));
    mockUnitFindUnique.mockResolvedValue({
      id: "unit-1",
      deletedAt: null,
      clientId: "primary-client",
      project: jamilaProject,
      unitClients: [],
    });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        client: { create: mockClientCreate },
        unitClient: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "link-new" }),
        },
      })
    );

    const { addUnitCoOwner } = await import("@/lib/actions/unit-clients");
    const result = await addUnitCoOwner({
      unitId: "unit-1",
      mode: "new",
      name: "Second Owner",
      email: "  owner@example.com  ",
    });

    expect(result.success).toBe(true);
    expect(mockClientCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "owner@example.com" }),
    });
  });

  it("rejects invalid email when adding a new co-owner", async () => {
    mockAuth.mockResolvedValue(session("MANAGEMENT"));
    mockUnitFindUnique.mockResolvedValue({
      id: "unit-1",
      deletedAt: null,
      clientId: "primary-client",
      project: jamilaProject,
      unitClients: [],
    });

    const { addUnitCoOwner } = await import("@/lib/actions/unit-clients");
    const result = await addUnitCoOwner({
      unitId: "unit-1",
      mode: "new",
      name: "Second Owner",
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("allows community on Jamila to add a co-owner", async () => {
    mockAuth.mockResolvedValue(session("COMMUNITY_MANAGEMENT"));
    mockUnitFindUnique.mockResolvedValue({
      id: "unit-1",
      deletedAt: null,
      clientId: "primary-client",
      project: jamilaProject,
      unitClients: [],
    });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        client: {
          create: vi.fn().mockResolvedValue({ id: "new-co" }),
        },
        unitClient: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "link-new" }),
        },
      })
    );

    const { addUnitCoOwner } = await import("@/lib/actions/unit-clients");
    const result = await addUnitCoOwner({
      unitId: "unit-1",
      mode: "new",
      name: "Second Owner",
    });

    expect(result.success).toBe(true);
  });
});
