import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Role } from "@prisma/client";

const mockPrismaUser = {
  findUnique: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: mockPrismaUser,
  },
}));

describe("ABAC - Attribute-Based Access Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("assertCsAgentCanMutateTicket", () => {
    it("allows SUPER_ADMIN to mutate any ticket", async () => {
      const { assertCsAgentCanMutateTicket } = await import("@/lib/auth/abac");
      
      const user = { id: "super-admin-1", role: "SUPER_ADMIN" as Role };
      const ticket = {
        agentId: "other-agent",
        unit: { agentId: "other-agent" },
      };
      
      const result = await assertCsAgentCanMutateTicket(user, ticket);
      
      expect(result).toBeNull();
    });

    it("allows MANAGEMENT to mutate any ticket", async () => {
      const { assertCsAgentCanMutateTicket } = await import("@/lib/auth/abac");
      
      const user = { id: "management-1", role: "MANAGEMENT" as Role };
      const ticket = {
        agentId: "other-agent",
        unit: { agentId: "other-agent" },
      };
      
      const result = await assertCsAgentCanMutateTicket(user, ticket);
      
      expect(result).toBeNull();
    });

    it("allows CS_AGENT to mutate their own ticket", async () => {
      const { assertCsAgentCanMutateTicket } = await import("@/lib/auth/abac");
      
      const agentId = "cs-agent-1";
      const user = { id: agentId, role: "CS_AGENT" as Role };
      const ticket = {
        agentId,
        unit: { agentId },
      };
      
      const result = await assertCsAgentCanMutateTicket(user, ticket);
      
      expect(result).toBeNull();
    });

    it("allows CS_AGENT to mutate ticket assigned to their unit", async () => {
      const { assertCsAgentCanMutateTicket } = await import("@/lib/auth/abac");
      
      const agentId = "cs-agent-1";
      const user = { id: agentId, role: "CS_AGENT" as Role };
      const ticket = {
        agentId: null,
        unit: { agentId },
      };
      
      const result = await assertCsAgentCanMutateTicket(user, ticket);
      
      expect(result).toBeNull();
    });

    it("denies CS_AGENT from mutating another agent's ticket", async () => {
      const { assertCsAgentCanMutateTicket } = await import("@/lib/auth/abac");
      
      const user = { id: "cs-agent-1", role: "CS_AGENT" as Role };
      const ticket = {
        agentId: "other-agent",
        unit: { agentId: "other-agent" },
      };
      
      const result = await assertCsAgentCanMutateTicket(user, ticket);
      
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies ENGINEER from mutating any ticket", async () => {
      const { assertCsAgentCanMutateTicket } = await import("@/lib/auth/abac");
      
      const user = { id: "engineer-1", role: "ENGINEER" as Role };
      const ticket = {
        agentId: "some-agent",
        unit: { agentId: "some-agent" },
      };
      
      const result = await assertCsAgentCanMutateTicket(user, ticket);
      
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });
  });

  describe("assertCsAgentUnitAccess", () => {
    it("allows SUPER_ADMIN to access any unit", async () => {
      const { assertCsAgentUnitAccess } = await import("@/lib/auth/abac");
      
      const user = { id: "super-admin-1", role: "SUPER_ADMIN" as Role };
      
      const result = await assertCsAgentUnitAccess(user, "other-agent");
      
      expect(result).toBeNull();
    });

    it("allows MANAGEMENT to access any unit", async () => {
      const { assertCsAgentUnitAccess } = await import("@/lib/auth/abac");
      
      const user = { id: "management-1", role: "MANAGEMENT" as Role };
      
      const result = await assertCsAgentUnitAccess(user, "other-agent");
      
      expect(result).toBeNull();
    });

    it("allows ENGINEER to access any unit", async () => {
      const { assertCsAgentUnitAccess } = await import("@/lib/auth/abac");
      
      const user = { id: "engineer-1", role: "ENGINEER" as Role };
      
      const result = await assertCsAgentUnitAccess(user, "other-agent");
      
      expect(result).toBeNull();
    });

    it("allows CS_AGENT to access their own unit", async () => {
      const { assertCsAgentUnitAccess } = await import("@/lib/auth/abac");
      
      const agentId = "cs-agent-1";
      const user = { id: agentId, role: "CS_AGENT" as Role };
      
      const result = await assertCsAgentUnitAccess(user, agentId);
      
      expect(result).toBeNull();
    });

    it("denies CS_AGENT from accessing another agent's unit", async () => {
      const { assertCsAgentUnitAccess } = await import("@/lib/auth/abac");
      
      const user = { id: "cs-agent-1", role: "CS_AGENT" as Role };
      
      const result = await assertCsAgentUnitAccess(user, "other-agent");
      
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies CS_AGENT from accessing unit with null agent", async () => {
      const { assertCsAgentUnitAccess } = await import("@/lib/auth/abac");
      
      const user = { id: "cs-agent-1", role: "CS_AGENT" as Role };
      
      const result = await assertCsAgentUnitAccess(user, null);
      
      expect(result).not.toBeNull();
      expect(result?.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });
  });

  describe("isPrivilegedRole", () => {
    it("returns true for SUPER_ADMIN", async () => {
      const { isPrivilegedRole } = await import("@/lib/auth/abac");
      
      expect(isPrivilegedRole("SUPER_ADMIN")).toBe(true);
    });

    it("returns true for MANAGEMENT", async () => {
      const { isPrivilegedRole } = await import("@/lib/auth/abac");
      
      expect(isPrivilegedRole("MANAGEMENT")).toBe(true);
    });

    it("returns false for CS_AGENT", async () => {
      const { isPrivilegedRole } = await import("@/lib/auth/abac");
      
      expect(isPrivilegedRole("CS_AGENT")).toBe(false);
    });

    it("returns false for ENGINEER", async () => {
      const { isPrivilegedRole } = await import("@/lib/auth/abac");
      
      expect(isPrivilegedRole("ENGINEER")).toBe(false);
    });
  });
});

describe("canManageUnitTickets", () => {
  it("returns true for SUPER_ADMIN", async () => {
    const { canManageUnitTickets } = await import("@/lib/auth/unit-ticket-access");
    
    expect(canManageUnitTickets({ role: "SUPER_ADMIN" })).toBe(true);
  });

  it("returns true for MANAGEMENT", async () => {
    const { canManageUnitTickets } = await import("@/lib/auth/unit-ticket-access");
    
    expect(canManageUnitTickets({ role: "MANAGEMENT" })).toBe(true);
  });

  it("returns false for CS_AGENT", async () => {
    const { canManageUnitTickets } = await import("@/lib/auth/unit-ticket-access");
    
    expect(canManageUnitTickets({ role: "CS_AGENT" })).toBe(false);
  });

  it("returns false for ENGINEER", async () => {
    const { canManageUnitTickets } = await import("@/lib/auth/unit-ticket-access");
    
    expect(canManageUnitTickets({ role: "ENGINEER" })).toBe(false);
  });
});

describe("CS Agent Scope Resolution", () => {
  describe("resolveCsAgentScope", () => {
    it("returns direct scope for non-CS_AGENT roles", async () => {
      const { resolveCsAgentScope } = await import("@/lib/auth/cs-agent-scope");
      
      const scope = await resolveCsAgentScope({
        id: "super-admin-1",
        email: "admin@test.com",
        role: "SUPER_ADMIN",
      });
      
      expect(scope.loginUserId).toBe("super-admin-1");
      expect(scope.effectiveAgentId).toBe("super-admin-1");
      expect(scope.isPreview).toBe(false);
    });

    it("returns direct scope for CS_AGENT without preview mapping", async () => {
      const { resolveCsAgentScope } = await import("@/lib/auth/cs-agent-scope");
      
      const scope = await resolveCsAgentScope({
        id: "cs-agent-1",
        email: "agent@test.com",
        role: "CS_AGENT",
      });
      
      expect(scope.loginUserId).toBe("cs-agent-1");
      expect(scope.effectiveAgentId).toBe("cs-agent-1");
      expect(scope.isPreview).toBe(false);
    });
  });

  describe("canAccessUnitAsCsAgent", () => {
    it("returns true when unit agent matches effective agent", async () => {
      const { canAccessUnitAsCsAgent } = await import("@/lib/auth/cs-agent-scope");
      
      const scope = {
        loginUserId: "cs-agent-1",
        effectiveAgentId: "cs-agent-1",
        isPreview: false,
      };
      
      expect(canAccessUnitAsCsAgent(scope, "cs-agent-1")).toBe(true);
    });

    it("returns false when unit agent does not match", async () => {
      const { canAccessUnitAsCsAgent } = await import("@/lib/auth/cs-agent-scope");
      
      const scope = {
        loginUserId: "cs-agent-1",
        effectiveAgentId: "cs-agent-1",
        isPreview: false,
      };
      
      expect(canAccessUnitAsCsAgent(scope, "other-agent")).toBe(false);
    });

    it("returns false when unit has no agent", async () => {
      const { canAccessUnitAsCsAgent } = await import("@/lib/auth/cs-agent-scope");
      
      const scope = {
        loginUserId: "cs-agent-1",
        effectiveAgentId: "cs-agent-1",
        isPreview: false,
      };
      
      expect(canAccessUnitAsCsAgent(scope, null)).toBe(false);
    });

    it("returns true in preview mode with effective agent match", async () => {
      const { canAccessUnitAsCsAgent } = await import("@/lib/auth/cs-agent-scope");
      
      const scope = {
        loginUserId: "preview-user",
        effectiveAgentId: "target-agent",
        isPreview: true,
        previewSourceEmail: "target@test.com",
      };
      
      expect(canAccessUnitAsCsAgent(scope, "target-agent")).toBe(true);
    });
  });

  describe("csAgentTicketScope", () => {
    it("returns correct Prisma query scope", async () => {
      const { csAgentTicketScope } = await import("@/lib/auth/cs-agent-scope");
      
      const scope = {
        loginUserId: "cs-agent-1",
        effectiveAgentId: "cs-agent-1",
        isPreview: false,
      };
      
      const query = csAgentTicketScope(scope);
      
      expect(query).toEqual({
        OR: [
          { agentId: "cs-agent-1" },
          { unit: { agentId: "cs-agent-1" } },
        ],
      });
    });
  });

  describe("csAgentUnitScope", () => {
    it("returns correct Prisma query scope", async () => {
      const { csAgentUnitScope } = await import("@/lib/auth/cs-agent-scope");
      
      const scope = {
        loginUserId: "cs-agent-1",
        effectiveAgentId: "cs-agent-1",
        isPreview: false,
      };
      
      const query = csAgentUnitScope(scope);
      
      expect(query).toEqual({ agentId: "cs-agent-1" });
    });
  });
});
