import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Role } from "@prisma/client";

const mockAuth = vi.fn();
const mockPrismaUser = {
  findUnique: vi.fn(),
  update: vi.fn(),
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

const mockBcrypt = {
  hash: vi.fn().mockResolvedValue("hashed-password"),
  compare: vi.fn(),
};

vi.mock("bcryptjs", () => ({
  default: mockBcrypt,
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

describe("Password Management Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBcrypt.compare.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("forcePasswordChange", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { forcePasswordChange } = await import("@/lib/actions/password");
      const formData = new FormData();
      formData.set("newPassword", "newpassword123");
      formData.set("confirmPassword", "newpassword123");
      
      const result = await forcePasswordChange(formData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("unauthorized");
    });

    it("rejects password shorter than 8 characters", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "user-1",
        role: "CS_AGENT",
      }));
      
      const { forcePasswordChange } = await import("@/lib/actions/password");
      const formData = new FormData();
      formData.set("newPassword", "short");
      formData.set("confirmPassword", "short");
      
      const result = await forcePasswordChange(formData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("tooShort");
    });

    it("rejects mismatched passwords", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "user-1",
        role: "CS_AGENT",
      }));
      
      const { forcePasswordChange } = await import("@/lib/actions/password");
      const formData = new FormData();
      formData.set("newPassword", "newpassword123");
      formData.set("confirmPassword", "differentpassword");
      
      const result = await forcePasswordChange(formData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("mismatch");
    });

    it("rejects default password", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "user-1",
        role: "CS_AGENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        password: "old-hashed-password",
      });
      
      const { forcePasswordChange } = await import("@/lib/actions/password");
      const formData = new FormData();
      formData.set("newPassword", "ChangeMe123!");
      formData.set("confirmPassword", "ChangeMe123!");
      
      const result = await forcePasswordChange(formData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("defaultPassword");
    });

    it("rejects reuse of current password", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "user-1",
        role: "CS_AGENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        password: "current-hashed-password",
      });
      mockBcrypt.compare.mockResolvedValue(true);
      
      const { forcePasswordChange } = await import("@/lib/actions/password");
      const formData = new FormData();
      formData.set("newPassword", "samepassword123");
      formData.set("confirmPassword", "samepassword123");
      
      const result = await forcePasswordChange(formData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("sameAsCurrent");
    });

    it("successfully changes password when valid", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "user-1",
        role: "CS_AGENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        password: "old-hashed-password",
      });
      mockBcrypt.compare.mockResolvedValue(false);
      mockPrismaUser.update.mockResolvedValue({
        id: "user-1",
        requiresPasswordChange: false,
      });
      
      const { forcePasswordChange } = await import("@/lib/actions/password");
      const formData = new FormData();
      formData.set("newPassword", "newsecurepassword123");
      formData.set("confirmPassword", "newsecurepassword123");
      
      const result = await forcePasswordChange(formData);
      
      expect(result.success).toBe(true);
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          password: "hashed-password",
          requiresPasswordChange: false,
        },
      });
    });
  });

  describe("adminChangeUserPassword", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { adminChangeUserPassword } = await import("@/lib/actions/users");
      const result = await adminChangeUserPassword("user-1", "newpassword123");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for CS_AGENT role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "cs-agent-1",
        role: "CS_AGENT",
      }));
      
      const { adminChangeUserPassword } = await import("@/lib/actions/users");
      const result = await adminChangeUserPassword("user-1", "newpassword123");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("prevents changing own password", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      const { adminChangeUserPassword } = await import("@/lib/actions/users");
      const result = await adminChangeUserPassword("super-admin-1", "newpassword123");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Cannot change your own password here");
    });

    it("rejects password shorter than 8 characters", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      const { adminChangeUserPassword } = await import("@/lib/actions/users");
      const result = await adminChangeUserPassword("user-1", "short");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Password must be at least 8 characters");
    });

    it("allows SUPER_ADMIN to change other user's password", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "cs-agent-1",
        role: "CS_AGENT",
        deletedAt: null,
      });
      mockPrismaUser.update.mockResolvedValue({
        id: "cs-agent-1",
        requiresPasswordChange: false,
      });
      
      const { adminChangeUserPassword } = await import("@/lib/actions/users");
      const result = await adminChangeUserPassword("cs-agent-1", "newpassword123");
      
      expect(result.success).toBe(true);
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: "cs-agent-1" },
        data: expect.objectContaining({
          password: "hashed-password",
          requiresPasswordChange: false,
          sessionVersion: { increment: 1 },
        }),
      });
    });

    it("allows MANAGEMENT to change non-admin user's password", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "cs-agent-1",
        role: "CS_AGENT",
        deletedAt: null,
      });
      mockPrismaUser.update.mockResolvedValue({
        id: "cs-agent-1",
        requiresPasswordChange: false,
      });
      
      const { adminChangeUserPassword } = await import("@/lib/actions/users");
      const result = await adminChangeUserPassword("cs-agent-1", "newpassword123");
      
      expect(result.success).toBe(true);
    });

    it("denies MANAGEMENT from changing SUPER_ADMIN password", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
        deletedAt: null,
      });
      
      const { adminChangeUserPassword } = await import("@/lib/actions/users");
      const result = await adminChangeUserPassword("super-admin-1", "newpassword123");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Cannot modify super admin");
    });

    it("returns error for deleted user", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "deleted-user",
        role: "CS_AGENT",
        deletedAt: new Date(),
      });
      
      const { adminChangeUserPassword } = await import("@/lib/actions/users");
      const result = await adminChangeUserPassword("deleted-user", "newpassword123");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "User not found");
    });
  });

  describe("toggleUserStatus", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { toggleUserStatus } = await import("@/lib/actions/users");
      const result = await toggleUserStatus("user-1", false);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for CS_AGENT role", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "cs-agent-1",
        role: "CS_AGENT",
      }));
      
      const { toggleUserStatus } = await import("@/lib/actions/users");
      const result = await toggleUserStatus("user-1", false);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("prevents changing own status", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      const { toggleUserStatus } = await import("@/lib/actions/users");
      const result = await toggleUserStatus("super-admin-1", false);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Cannot change your own account status");
    });

    it("allows SUPER_ADMIN to disable user", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "cs-agent-1",
        role: "CS_AGENT",
        isActive: true,
        deletedAt: null,
      });
      mockPrismaUser.update.mockResolvedValue({
        id: "cs-agent-1",
        isActive: false,
      });
      
      const { toggleUserStatus } = await import("@/lib/actions/users");
      const result = await toggleUserStatus("cs-agent-1", false);
      
      expect(result.success).toBe(true);
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: "cs-agent-1" },
        data: {
          isActive: false,
          sessionVersion: { increment: 1 },
        },
      });
    });

    it("allows SUPER_ADMIN to enable user", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "cs-agent-1",
        role: "CS_AGENT",
        isActive: false,
        deletedAt: null,
      });
      mockPrismaUser.update.mockResolvedValue({
        id: "cs-agent-1",
        isActive: true,
      });
      
      const { toggleUserStatus } = await import("@/lib/actions/users");
      const result = await toggleUserStatus("cs-agent-1", true);
      
      expect(result.success).toBe(true);
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: "cs-agent-1" },
        data: {
          isActive: true,
        },
      });
    });

    it("denies MANAGEMENT from modifying SUPER_ADMIN status", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
        isActive: true,
        deletedAt: null,
      });
      
      const { toggleUserStatus } = await import("@/lib/actions/users");
      const result = await toggleUserStatus("super-admin-1", false);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Cannot modify super admin");
    });

    it("returns success if status already matches", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "cs-agent-1",
        role: "CS_AGENT",
        isActive: true,
        deletedAt: null,
      });
      
      const { toggleUserStatus } = await import("@/lib/actions/users");
      const result = await toggleUserStatus("cs-agent-1", true);
      
      expect(result.success).toBe(true);
      expect(mockPrismaUser.update).not.toHaveBeenCalled();
    });
  });
});
