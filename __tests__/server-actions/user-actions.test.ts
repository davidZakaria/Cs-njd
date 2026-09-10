import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Role } from "@prisma/client";

const mockAuth = vi.fn();
const mockPrismaUser = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: mockPrismaUser,
  },
  auditContext: {
    run: <T>(_ctx: unknown, fn: () => T) => fn(),
  },
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve({
    get: () => "127.0.0.1",
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

function createMockSession(user: {
  id: string;
  email?: string;
  name?: string;
  role: Role;
} | null) {
  if (!user) return null;
  return {
    user: {
      id: user.id,
      email: user.email ?? "user@test.com",
      name: user.name ?? "Test User",
      role: user.role,
    },
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

describe("User Management Server Actions - RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createUser", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { createUser } = await import("@/lib/actions/crm");
      const result = await createUser({
        name: "New User",
        email: "new@test.com",
        password: "password123",
        role: "CS_AGENT",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for CS_AGENT role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "cs-agent-1",
        role: "CS_AGENT",
      }));
      
      const { createUser } = await import("@/lib/actions/crm");
      const result = await createUser({
        name: "New User",
        email: "new@test.com",
        password: "password123",
        role: "CS_AGENT",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for ENGINEER role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "engineer-1",
        role: "ENGINEER",
      }));
      
      const { createUser } = await import("@/lib/actions/crm");
      const result = await createUser({
        name: "New User",
        email: "new@test.com",
        password: "password123",
        role: "CS_AGENT",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("allows SUPER_ADMIN to create any user", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue(null);
      mockPrismaUser.count.mockResolvedValue(0);
      mockPrismaUser.create.mockResolvedValue({
        id: "new-user-id",
        name: "New User",
        email: "new@test.com",
        role: "CS_AGENT",
      });
      
      const { createUser } = await import("@/lib/actions/crm");
      const result = await createUser({
        name: "New User",
        email: "new@test.com",
        password: "password123",
        role: "CS_AGENT",
      });
      
      expect(result.success).toBe(true);
    });

    it("allows MANAGEMENT to create CS_AGENT", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue(null);
      mockPrismaUser.create.mockResolvedValue({
        id: "new-user-id",
        name: "New User",
        email: "new@test.com",
        role: "CS_AGENT",
      });
      
      const { createUser } = await import("@/lib/actions/crm");
      const result = await createUser({
        name: "New Agent",
        email: "newagent@test.com",
        password: "password123",
        role: "CS_AGENT",
      });
      
      expect(result.success).toBe(true);
    });

    it("allows MANAGEMENT to create ENGINEER", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue(null);
      mockPrismaUser.count.mockResolvedValue(0);
      mockPrismaUser.create.mockResolvedValue({
        id: "new-user-id",
        name: "Site Engineer",
        email: "engineer@test.com",
        role: "ENGINEER",
      });
      
      const { createUser } = await import("@/lib/actions/crm");
      const result = await createUser({
        name: "Site Engineer",
        email: "engineer@test.com",
        password: "password123",
        role: "ENGINEER",
      });
      
      expect(result.success).toBe(true);
    });

    it("denies MANAGEMENT from creating SUPER_ADMIN", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      const { createUser } = await import("@/lib/actions/crm");
      const result = await createUser({
        name: "New Admin",
        email: "admin@test.com",
        password: "password123",
        role: "SUPER_ADMIN",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Management can only create CS agents or site engineers");
    });

    it("denies MANAGEMENT from creating MANAGEMENT", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      const { createUser } = await import("@/lib/actions/crm");
      const result = await createUser({
        name: "New Manager",
        email: "manager@test.com",
        password: "password123",
        role: "MANAGEMENT",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Management can only create CS agents or site engineers");
    });

    it("rejects duplicate email", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "existing-user",
        email: "existing@test.com",
      });
      
      const { createUser } = await import("@/lib/actions/crm");
      const result = await createUser({
        name: "New User",
        email: "existing@test.com",
        password: "password123",
        role: "CS_AGENT",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "A user with this email already exists");
    });

    it("enforces single engineer limit", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue(null);
      mockPrismaUser.count.mockResolvedValue(1);
      
      const { createUser } = await import("@/lib/actions/crm");
      const result = await createUser({
        name: "Another Engineer",
        email: "engineer2@test.com",
        password: "password123",
        role: "ENGINEER",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error).toContain("Only one shared site engineer account");
    });
  });

  describe("updateUser", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { updateUser } = await import("@/lib/actions/crm");
      const result = await updateUser({
        id: "user-1",
        name: "Updated Name",
        email: "updated@test.com",
        role: "CS_AGENT",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for CS_AGENT role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "cs-agent-1",
        role: "CS_AGENT",
      }));
      
      const { updateUser } = await import("@/lib/actions/crm");
      const result = await updateUser({
        id: "user-1",
        name: "Updated Name",
        email: "updated@test.com",
        role: "CS_AGENT",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("allows SUPER_ADMIN to update user", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique
        .mockResolvedValueOnce({
          id: "user-1",
          name: "Old Name",
          email: "old@test.com",
          role: "CS_AGENT",
        })
        .mockResolvedValueOnce(null);
      mockPrismaUser.update.mockResolvedValue({
        id: "user-1",
        name: "Updated Name",
        email: "updated@test.com",
        role: "CS_AGENT",
      });
      
      const { updateUser } = await import("@/lib/actions/crm");
      const result = await updateUser({
        id: "user-1",
        name: "Updated Name",
        email: "updated@test.com",
        role: "CS_AGENT",
      });
      
      expect(result.success).toBe(true);
    });

    it("denies MANAGEMENT from modifying SUPER_ADMIN", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "super-admin-1",
        name: "Super Admin",
        email: "admin@test.com",
        role: "SUPER_ADMIN",
      });
      
      const { updateUser } = await import("@/lib/actions/crm");
      const result = await updateUser({
        id: "super-admin-1",
        name: "Modified Admin",
        email: "admin@test.com",
        role: "SUPER_ADMIN",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Cannot modify super admin");
    });

    it("denies MANAGEMENT from promoting to SUPER_ADMIN", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "cs-agent-1",
        name: "CS Agent",
        email: "agent@test.com",
        role: "CS_AGENT",
      });
      
      const { updateUser } = await import("@/lib/actions/crm");
      const result = await updateUser({
        id: "cs-agent-1",
        name: "Promoted Agent",
        email: "agent@test.com",
        role: "SUPER_ADMIN",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Management can only assign CS agent or site engineer role");
    });

    it("returns error when user not found", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue(null);
      
      const { updateUser } = await import("@/lib/actions/crm");
      const result = await updateUser({
        id: "nonexistent",
        name: "Updated Name",
        email: "updated@test.com",
        role: "CS_AGENT",
      });
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "User not found");
    });
  });

  describe("deleteUser", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { deleteUser } = await import("@/lib/actions/crm");
      const result = await deleteUser("user-1");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for non-SUPER_ADMIN roles", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      const { deleteUser } = await import("@/lib/actions/crm");
      const result = await deleteUser("user-1");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("allows SUPER_ADMIN to delete non-admin users", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "cs-agent-1",
        name: "CS Agent",
        email: "agent@test.com",
        role: "CS_AGENT",
      });
      mockPrismaUser.update.mockResolvedValue({
        id: "cs-agent-1",
        deletedAt: new Date(),
      });
      
      const { deleteUser } = await import("@/lib/actions/crm");
      const result = await deleteUser("cs-agent-1");
      
      expect(result.success).toBe(true);
    });

    it("prevents SUPER_ADMIN from deleting themselves", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      const { deleteUser } = await import("@/lib/actions/crm");
      const result = await deleteUser("super-admin-1");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Cannot delete yourself");
    });

    it("prevents deletion of SUPER_ADMIN users", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "super-admin-2",
        name: "Another Admin",
        email: "admin2@test.com",
        role: "SUPER_ADMIN",
      });
      
      const { deleteUser } = await import("@/lib/actions/crm");
      const result = await deleteUser("super-admin-2");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Cannot delete this user");
    });
  });

  describe("forcePasswordResetByAdmin", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { forcePasswordResetByAdmin } = await import("@/lib/actions/crm");
      const result = await forcePasswordResetByAdmin("user-1");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for CS_AGENT role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "cs-agent-1",
        role: "CS_AGENT",
      }));
      
      const { forcePasswordResetByAdmin } = await import("@/lib/actions/crm");
      const result = await forcePasswordResetByAdmin("user-1");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("allows SUPER_ADMIN to force password reset", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "cs-agent-1",
        name: "CS Agent",
        role: "CS_AGENT",
      });
      mockPrismaUser.update.mockResolvedValue({
        id: "cs-agent-1",
        requiresPasswordChange: true,
      });
      
      const { forcePasswordResetByAdmin } = await import("@/lib/actions/crm");
      const result = await forcePasswordResetByAdmin("cs-agent-1");
      
      expect(result.success).toBe(true);
    });

    it("allows MANAGEMENT to force password reset for non-admins", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "cs-agent-1",
        name: "CS Agent",
        role: "CS_AGENT",
      });
      mockPrismaUser.update.mockResolvedValue({
        id: "cs-agent-1",
        requiresPasswordChange: true,
      });
      
      const { forcePasswordResetByAdmin } = await import("@/lib/actions/crm");
      const result = await forcePasswordResetByAdmin("cs-agent-1");
      
      expect(result.success).toBe(true);
    });

    it("prevents forcing password reset on yourself", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      const { forcePasswordResetByAdmin } = await import("@/lib/actions/crm");
      const result = await forcePasswordResetByAdmin("super-admin-1");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Cannot force password reset on yourself");
    });

    it("denies MANAGEMENT from forcing password reset on SUPER_ADMIN", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "super-admin-1",
        name: "Super Admin",
        role: "SUPER_ADMIN",
      });
      
      const { forcePasswordResetByAdmin } = await import("@/lib/actions/crm");
      const result = await forcePasswordResetByAdmin("super-admin-1");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Cannot modify super admin");
    });
  });
});
