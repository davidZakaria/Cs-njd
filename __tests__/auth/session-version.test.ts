import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { JWT } from "@auth/core/jwt";

const mockPrismaUser = {
  findUnique: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: mockPrismaUser,
  },
}));

describe("Session Version & Revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("applySessionVersionToToken", () => {
    it("returns token unchanged when no id present", async () => {
      const { applySessionVersionToToken } = await import("@/lib/auth/session-version");
      
      const token = {
        role: "CS_AGENT",
        is2FAEnabled: true,
        needs2FASetup: false,
        twoFactorVerified: true,
        requiresPasswordChange: false,
      } as JWT;
      
      const result = await applySessionVersionToToken(token);
      
      expect(result).toEqual(token);
      expect(mockPrismaUser.findUnique).not.toHaveBeenCalled();
    });

    it("revokes session when user is deleted", async () => {
      const { applySessionVersionToToken, SESSION_REVOKED_ERROR } = await import("@/lib/auth/session-version");
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        sessionVersion: 1,
        deletedAt: new Date(),
        role: "CS_AGENT",
        is2FAEnabled: true,
        requiresPasswordChange: false,
        twoFactorSecret: "secret",
      });
      
      const token: JWT = {
        id: "user-1",
        role: "CS_AGENT",
        is2FAEnabled: true,
        needs2FASetup: false,
        twoFactorVerified: true,
        requiresPasswordChange: false,
        sessionVersion: 1,
      };
      
      const result = await applySessionVersionToToken(token);
      
      expect(result.error).toBe(SESSION_REVOKED_ERROR);
    });

    it("revokes session when user not found", async () => {
      const { applySessionVersionToToken, SESSION_REVOKED_ERROR } = await import("@/lib/auth/session-version");
      
      mockPrismaUser.findUnique.mockResolvedValue(null);
      
      const token: JWT = {
        id: "nonexistent-user",
        role: "CS_AGENT",
        is2FAEnabled: true,
        needs2FASetup: false,
        twoFactorVerified: true,
        requiresPasswordChange: false,
        sessionVersion: 1,
      };
      
      const result = await applySessionVersionToToken(token);
      
      expect(result.error).toBe(SESSION_REVOKED_ERROR);
    });

    it("revokes session when version mismatch", async () => {
      const { applySessionVersionToToken, SESSION_REVOKED_ERROR } = await import("@/lib/auth/session-version");
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        sessionVersion: 2,
        deletedAt: null,
        role: "CS_AGENT",
        is2FAEnabled: true,
        requiresPasswordChange: false,
        twoFactorSecret: "secret",
      });
      
      const token: JWT = {
        id: "user-1",
        role: "CS_AGENT",
        is2FAEnabled: true,
        needs2FASetup: false,
        twoFactorVerified: true,
        requiresPasswordChange: false,
        sessionVersion: 1,
      };
      
      const result = await applySessionVersionToToken(token);
      
      expect(result.error).toBe(SESSION_REVOKED_ERROR);
    });

    it("syncs session when version matches", async () => {
      const { applySessionVersionToToken } = await import("@/lib/auth/session-version");
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        sessionVersion: 1,
        deletedAt: null,
        role: "CS_AGENT",
        is2FAEnabled: true,
        requiresPasswordChange: false,
        twoFactorSecret: "secret",
      });
      
      const token: JWT = {
        id: "user-1",
        role: "CS_AGENT",
        is2FAEnabled: false,
        needs2FASetup: true,
        twoFactorVerified: true,
        requiresPasswordChange: true,
        sessionVersion: 1,
      };
      
      const result = await applySessionVersionToToken(token);
      
      expect(result.error).toBeUndefined();
      expect(result.sessionVersion).toBe(1);
      expect(result.is2FAEnabled).toBe(true);
      expect(result.needs2FASetup).toBe(false);
    });

    it("syncs first time when sessionVersion is null", async () => {
      const { applySessionVersionToToken } = await import("@/lib/auth/session-version");
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        sessionVersion: 1,
        deletedAt: null,
        role: "CS_AGENT",
        is2FAEnabled: true,
        requiresPasswordChange: false,
        twoFactorSecret: "secret",
      });
      
      const token: JWT = {
        id: "user-1",
        role: "CS_AGENT",
        is2FAEnabled: false,
        needs2FASetup: true,
        twoFactorVerified: true,
        requiresPasswordChange: true,
      };
      
      const result = await applySessionVersionToToken(token);
      
      expect(result.error).toBeUndefined();
      expect(result.sessionVersion).toBe(1);
    });

    it("bypasses 2FA for ENGINEER role", async () => {
      const { applySessionVersionToToken } = await import("@/lib/auth/session-version");
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "engineer-1",
        sessionVersion: 1,
        deletedAt: null,
        role: "ENGINEER",
        is2FAEnabled: false,
        requiresPasswordChange: false,
        twoFactorSecret: null,
      });
      
      const token: JWT = {
        id: "engineer-1",
        role: "ENGINEER",
        is2FAEnabled: false,
        needs2FASetup: true,
        twoFactorVerified: false,
        requiresPasswordChange: false,
        sessionVersion: 1,
      };
      
      const result = await applySessionVersionToToken(token);
      
      expect(result.error).toBeUndefined();
      expect(result.is2FAEnabled).toBe(false);
      expect(result.needs2FASetup).toBe(false);
      expect(result.twoFactorVerified).toBe(true);
    });

    it("detects need for 2FA setup when secret is missing", async () => {
      const { applySessionVersionToToken } = await import("@/lib/auth/session-version");
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        sessionVersion: 1,
        deletedAt: null,
        role: "CS_AGENT",
        is2FAEnabled: false,
        requiresPasswordChange: false,
        twoFactorSecret: null,
      });
      
      const token: JWT = {
        id: "user-1",
        role: "CS_AGENT",
        is2FAEnabled: false,
        needs2FASetup: false,
        twoFactorVerified: true,
        requiresPasswordChange: false,
        sessionVersion: 1,
      };
      
      const result = await applySessionVersionToToken(token);
      
      expect(result.needs2FASetup).toBe(true);
      expect(result.twoFactorVerified).toBe(false);
    });

    it("syncs requiresPasswordChange from database", async () => {
      const { applySessionVersionToToken } = await import("@/lib/auth/session-version");
      
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        sessionVersion: 1,
        deletedAt: null,
        role: "CS_AGENT",
        is2FAEnabled: true,
        requiresPasswordChange: true,
        twoFactorSecret: "secret",
      });
      
      const token: JWT = {
        id: "user-1",
        role: "CS_AGENT",
        is2FAEnabled: true,
        needs2FASetup: false,
        twoFactorVerified: true,
        requiresPasswordChange: false,
        sessionVersion: 1,
      };
      
      const result = await applySessionVersionToToken(token);
      
      expect(result.requiresPasswordChange).toBe(true);
    });
  });
});
