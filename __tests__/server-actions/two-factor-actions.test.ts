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

const mockVerifyTotp = vi.fn();
vi.mock("@/lib/two-factor", () => ({
  verifyTotp: () => mockVerifyTotp(),
  generateTotpSecret: vi.fn().mockReturnValue("test-secret"),
  generateQrDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,test"),
}));

const mockRateLimit = {
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  recordFailure: vi.fn(),
  clearFailures: vi.fn(),
  authRateLimitKey: vi.fn((scope: string, ip: string | undefined) => `${scope}:${ip}`),
  AUTH_RATE_LIMIT_ERROR: "RATE_LIMITED",
};

vi.mock("@/lib/security/rate-limit", () => mockRateLimit);

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

describe("Two-Factor Authentication Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.checkRateLimit.mockReturnValue({ allowed: true });
    mockVerifyTotp.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("verify2FA", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { verify2FA } = await import("@/lib/actions/two-factor");
      const result = await verify2FA("123456");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "SESSION_EXPIRED");
    });

    it("returns error when rate limited", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "user-1",
        role: "CS_AGENT",
      }));
      
      mockRateLimit.checkRateLimit.mockReturnValue({ allowed: false });
      
      const { verify2FA } = await import("@/lib/actions/two-factor");
      const result = await verify2FA("123456");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "RATE_LIMITED");
    });

    it("returns error when code is empty", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "user-1",
        role: "CS_AGENT",
      }));
      
      const { verify2FA } = await import("@/lib/actions/two-factor");
      const result = await verify2FA("   ");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "CODE_REQUIRED");
    });

    it("returns error when code is wrong length", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "user-1",
        role: "CS_AGENT",
      }));
      
      const { verify2FA } = await import("@/lib/actions/two-factor");
      const result = await verify2FA("12345");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "CODE_LENGTH");
    });

    it("returns error when 2FA not configured", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "user-1",
        role: "CS_AGENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        twoFactorSecret: null,
        is2FAEnabled: false,
      });
      
      const { verify2FA } = await import("@/lib/actions/two-factor");
      const result = await verify2FA("123456");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "NOT_CONFIGURED");
    });

    it("returns error when code is invalid", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "user-1",
        role: "CS_AGENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        twoFactorSecret: "secret",
        is2FAEnabled: true,
      });
      mockVerifyTotp.mockReturnValue(false);
      
      const { verify2FA } = await import("@/lib/actions/two-factor");
      const result = await verify2FA("123456");
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "INVALID_CODE");
      expect(mockRateLimit.recordFailure).toHaveBeenCalled();
    });

    it("succeeds with valid code", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "user-1",
        role: "CS_AGENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        twoFactorSecret: "secret",
        is2FAEnabled: true,
      });
      mockVerifyTotp.mockReturnValue(true);
      
      const { verify2FA } = await import("@/lib/actions/two-factor");
      const result = await verify2FA("123456");
      
      expect(result.success).toBe(true);
      expect(mockRateLimit.clearFailures).toHaveBeenCalled();
    });

    it("strips non-numeric characters from code", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "user-1",
        role: "CS_AGENT",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        twoFactorSecret: "secret",
        is2FAEnabled: true,
      });
      mockVerifyTotp.mockReturnValue(true);
      
      const { verify2FA } = await import("@/lib/actions/two-factor");
      const result = await verify2FA("123-456");
      
      expect(result.success).toBe(true);
    });
  });

  describe("resetMy2FASetup", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { resetMy2FASetup } = await import("@/lib/actions/two-factor");
      const result = await resetMy2FASetup();
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "SESSION_EXPIRED");
    });

    it("resets 2FA settings for authenticated user", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "user-1",
        role: "CS_AGENT",
      }));
      
      mockPrismaUser.update.mockResolvedValue({
        id: "user-1",
        is2FAEnabled: false,
        twoFactorSecret: null,
      });
      
      const { resetMy2FASetup } = await import("@/lib/actions/two-factor");
      const result = await resetMy2FASetup();
      
      expect(result.success).toBe(true);
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { is2FAEnabled: false, twoFactorSecret: null },
      });
    });
  });

  describe("setUserTwoFactorByAdmin", () => {
    it("denies access for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      
      const { setUserTwoFactorByAdmin } = await import("@/lib/actions/two-factor");
      const result = await setUserTwoFactorByAdmin("user-1", true);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("denies access for non-SUPER_ADMIN roles", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "management-1",
        role: "MANAGEMENT",
      }));
      
      const { setUserTwoFactorByAdmin } = await import("@/lib/actions/two-factor");
      const result = await setUserTwoFactorByAdmin("user-1", true);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Unauthorized");
    });

    it("prevents changing own 2FA", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      const { setUserTwoFactorByAdmin } = await import("@/lib/actions/two-factor");
      const result = await setUserTwoFactorByAdmin("super-admin-1", true);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "Cannot change your own 2FA here");
    });

    it("returns error when user not found", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue(null);
      
      const { setUserTwoFactorByAdmin } = await import("@/lib/actions/two-factor");
      const result = await setUserTwoFactorByAdmin("nonexistent", true);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error", "User not found");
    });

    it("cannot enable 2FA without secret set up", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        is2FAEnabled: false,
        twoFactorSecret: null,
      });
      
      const { setUserTwoFactorByAdmin } = await import("@/lib/actions/two-factor");
      const result = await setUserTwoFactorByAdmin("user-1", true);
      
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error).toContain("has not completed 2FA setup");
    });

    it("can enable 2FA when secret exists", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        is2FAEnabled: false,
        twoFactorSecret: "secret",
      });
      mockPrismaUser.update.mockResolvedValue({
        id: "user-1",
        is2FAEnabled: true,
      });
      
      const { setUserTwoFactorByAdmin } = await import("@/lib/actions/two-factor");
      const result = await setUserTwoFactorByAdmin("user-1", true);
      
      expect(result.success).toBe(true);
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { is2FAEnabled: true },
      });
    });

    it("can disable/reset 2FA", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        is2FAEnabled: true,
        twoFactorSecret: "secret",
      });
      mockPrismaUser.update.mockResolvedValue({
        id: "user-1",
        is2FAEnabled: false,
        twoFactorSecret: null,
      });
      
      const { setUserTwoFactorByAdmin } = await import("@/lib/actions/two-factor");
      const result = await setUserTwoFactorByAdmin("user-1", false);
      
      expect(result.success).toBe(true);
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { is2FAEnabled: false, twoFactorSecret: null },
      });
    });

    it("returns success when already enabled", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        is2FAEnabled: true,
        twoFactorSecret: "secret",
      });
      
      const { setUserTwoFactorByAdmin } = await import("@/lib/actions/two-factor");
      const result = await setUserTwoFactorByAdmin("user-1", true);
      
      expect(result.success).toBe(true);
      expect(mockPrismaUser.update).not.toHaveBeenCalled();
    });

    it("returns success when already disabled and no secret", async () => {
      mockAuth.mockResolvedValue(createMockSession({
        id: "super-admin-1",
        role: "SUPER_ADMIN",
      }));
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        is2FAEnabled: false,
        twoFactorSecret: null,
      });
      
      const { setUserTwoFactorByAdmin } = await import("@/lib/actions/two-factor");
      const result = await setUserTwoFactorByAdmin("user-1", false);
      
      expect(result.success).toBe(true);
      expect(mockPrismaUser.update).not.toHaveBeenCalled();
    });
  });
});
