import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@prisma/client";

vi.mock("server-only", () => ({}));

const mockAuth = vi.fn();
const mockUnitFindUnique = vi.fn();
const mockUnitFindMany = vi.fn();
const mockUnitFindFirst = vi.fn();
const mockUnitRequestCreate = vi.fn();
const mockRecordRequestAuditEvent = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unit: {
      findUnique: (...args: unknown[]) => mockUnitFindUnique(...args),
      findMany: (...args: unknown[]) => mockUnitFindMany(...args),
      findFirst: (...args: unknown[]) => mockUnitFindFirst(...args),
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

function managementSession() {
  return {
    user: {
      id: "mgmt-1",
      role: "MANAGEMENT" as Role,
      name: "Manager",
    },
  };
}

function csSession(agentId = "cs-agent-1") {
  return {
    user: {
      id: agentId,
      role: "CS_AGENT" as Role,
      name: "CS Agent",
    },
  };
}

const sampleUnitRow = {
  id: "unit-1",
  unitCode: "A-101",
  project: { name: "Green Avenue" },
  client: { name: "Ahmed Ali" },
  unitClients: [] as Array<{ role: string; client: { name: string } }>,
};

describe("unit request picker actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnitRequestCreate.mockResolvedValue({ id: "req-1" });
    mockRecordRequestAuditEvent.mockResolvedValue(undefined);
  });

  it("returns empty search results for short queries", async () => {
    mockAuth.mockResolvedValue(managementSession());
    const { searchUnitsForRequestPickerAction } = await import(
      "@/lib/actions/unit-requests"
    );

    await expect(searchUnitsForRequestPickerAction("a")).resolves.toEqual([]);
    expect(mockUnitFindMany).not.toHaveBeenCalled();
  });

  it("searches active units for management", async () => {
    mockAuth.mockResolvedValue(managementSession());
    mockUnitFindMany.mockResolvedValue([sampleUnitRow]);
    const { searchUnitsForRequestPickerAction } = await import(
      "@/lib/actions/unit-requests"
    );

    const rows = await searchUnitsForRequestPickerAction("green");
    expect(rows).toEqual([
      {
        unitId: "unit-1",
        unitCode: "A-101",
        projectName: "Green Avenue",
        clientName: "Ahmed Ali",
        label: "A-101 · Green Avenue · Ahmed Ali",
      },
    ]);
    expect(mockUnitFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
        take: 12,
      })
    );
  });

  it("excludes a unit id from search when requested", async () => {
    mockAuth.mockResolvedValue(managementSession());
    mockUnitFindMany.mockResolvedValue([]);
    const { searchUnitsForRequestPickerAction } = await import(
      "@/lib/actions/unit-requests"
    );

    await searchUnitsForRequestPickerAction("ahmed", "unit-source");
    expect(mockUnitFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ id: { not: "unit-source" } }]),
        }),
      })
    );
  });

  it("lets CS agents create requests on units assigned to other agents", async () => {
    mockAuth.mockResolvedValue(csSession());
    mockUnitFindUnique.mockResolvedValue({
      id: "unit-1",
      clientId: "client-1",
      deletedAt: null,
    });
    const { createUnitRequestAction } = await import("@/lib/actions/unit-requests");

    const result = await createUnitRequestAction({
      unitId: "unit-1",
      type: "CONTRACT_ISSUE_OR_AMENDMENT",
      description: "Need amendment",
    });

    expect(result).toEqual({ success: true, id: "req-1" });
    expect(mockUnitRequestCreate).toHaveBeenCalled();
  });

  it("creates draft when management selects an existing unit", async () => {
    mockAuth.mockResolvedValue(managementSession());
    mockUnitFindUnique.mockResolvedValue({
      id: "unit-1",
      clientId: "client-1",
      deletedAt: null,
    });
    const { createUnitRequestAction } = await import("@/lib/actions/unit-requests");

    const result = await createUnitRequestAction({
      unitId: "unit-1",
      type: "CONTRACT_ISSUE_OR_AMENDMENT",
      description: "Need amendment",
    });

    expect(result).toEqual({ success: true, id: "req-1" });
    expect(mockUnitRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitId: "unit-1",
          status: "DRAFT",
        }),
      })
    );
  });

  it("validates swap target unit exists and differs from source", async () => {
    mockAuth.mockResolvedValue(managementSession());
    mockUnitFindUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === "unit-1") {
        return Promise.resolve({
          id: "unit-1",
          clientId: "client-1",
          deletedAt: null,
        });
      }
      if (where.id === "unit-1") {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });
    const { createUnitRequestAction } = await import("@/lib/actions/unit-requests");

    const sameUnit = await createUnitRequestAction({
      unitId: "unit-1",
      type: "UNIT_SWAP",
      linkedSwapTargetUnitId: "unit-1",
    });
    expect(sameUnit).toEqual({
      success: false,
      error: "Target unit must be different from the source unit",
    });

    mockUnitFindUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === "unit-1") {
        return Promise.resolve({
          id: "unit-1",
          clientId: "client-1",
          deletedAt: null,
        });
      }
      if (where.id === "unit-2") {
        return Promise.resolve({
          id: "unit-2",
          clientId: null,
          deletedAt: null,
        });
      }
      return Promise.resolve(null);
    });

    const ok = await createUnitRequestAction({
      unitId: "unit-1",
      type: "UNIT_SWAP",
      linkedSwapTargetUnitId: "unit-2",
    });
    expect(ok).toEqual({ success: true, id: "req-1" });
  });

  it("resolves a visible unit for the picker", async () => {
    mockAuth.mockResolvedValue(managementSession());
    mockUnitFindFirst.mockResolvedValue(sampleUnitRow);
    const { resolveUnitForRequestPickerAction } = await import(
      "@/lib/actions/unit-requests"
    );

    await expect(resolveUnitForRequestPickerAction("unit-1")).resolves.toEqual({
      unitId: "unit-1",
      unitCode: "A-101",
      projectName: "Green Avenue",
      clientName: "Ahmed Ali",
      label: "A-101 · Green Avenue · Ahmed Ali",
    });
  });
});
