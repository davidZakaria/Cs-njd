import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: mockFindMany,
    },
  },
}));

describe("assignable agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads active CS_AGENT and MANAGEMENT users from the database", async () => {
    mockFindMany.mockResolvedValue([
      { id: "new-agent", name: "New Agent" },
      { id: "mgr-1", name: "Manager" },
    ]);

    const { getAssignableAgentUsers, assignableAgentUserWhere } = await import(
      "@/lib/units/assignable-agents"
    );

    const agents = await getAssignableAgentUsers();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: assignableAgentUserWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    expect(agents).toHaveLength(2);
    expect(assignableAgentUserWhere).toMatchObject({
      deletedAt: null,
      isActive: true,
      role: { in: ["CS_AGENT", "MANAGEMENT"] },
    });
  });

  it("isValidUnitAgentId accepts null and roster ids only", async () => {
    const { isValidUnitAgentId } = await import("@/lib/units/assignable-agents");
    const roster = [{ id: "a1", name: "A" }];

    expect(isValidUnitAgentId(null, roster)).toBe(true);
    expect(isValidUnitAgentId("a1", roster)).toBe(true);
    expect(isValidUnitAgentId("other", roster)).toBe(false);
  });
});

describe("staff roster", () => {
  it("keeps STAFF_ROSTER for import alias resolution only", async () => {
    const { STAFF_ROSTER, buildStaffAliasMap, normalizeAgentKey } = await import(
      "@/lib/staff"
    );

    expect(STAFF_ROSTER.length).toBeGreaterThan(0);
    const map = buildStaffAliasMap();
    const islam = STAFF_ROSTER.find((p) => p.email.includes("islam"));
    expect(islam).toBeDefined();
    expect(map.get(normalizeAgentKey("Islam Tharwat"))).toBe(islam!.email);

    const staffModule = await import("@/lib/staff");
    expect(staffModule).not.toHaveProperty("getAssignableAgentEmails");
  });
});
