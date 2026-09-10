import { describe, it, expect } from "vitest";
import {
  getAuthGatePath,
  getAuthGateRedirect,
  type AuthGateUser,
} from "@/lib/auth/auth-gate";

describe("Auth Gate Helpers", () => {
  describe("getAuthGatePath", () => {
    it("redirects to password change when required", () => {
      const user: AuthGateUser = {
        role: "CS_AGENT",
        requiresPasswordChange: true,
      };
      expect(getAuthGatePath(user)).toBe("/force-password-change");
    });

    it("redirects to 2FA setup when needed for CS_AGENT", () => {
      const user: AuthGateUser = {
        role: "CS_AGENT",
        requiresPasswordChange: false,
        needs2FASetup: true,
      };
      expect(getAuthGatePath(user)).toBe("/setup-2fa");
    });

    it("redirects to 2FA verify when not verified for CS_AGENT", () => {
      const user: AuthGateUser = {
        role: "CS_AGENT",
        requiresPasswordChange: false,
        needs2FASetup: false,
        twoFactorVerified: false,
      };
      expect(getAuthGatePath(user)).toBe("/verify-2fa");
    });

    it("redirects to 2FA setup for MANAGEMENT when needed", () => {
      const user: AuthGateUser = {
        role: "MANAGEMENT",
        requiresPasswordChange: false,
        needs2FASetup: true,
      };
      expect(getAuthGatePath(user)).toBe("/setup-2fa");
    });

    it("redirects to 2FA setup for SUPER_ADMIN when needed", () => {
      const user: AuthGateUser = {
        role: "SUPER_ADMIN",
        requiresPasswordChange: false,
        needs2FASetup: true,
      };
      expect(getAuthGatePath(user)).toBe("/setup-2fa");
    });

    it("does NOT require 2FA for ENGINEER role", () => {
      const user: AuthGateUser = {
        role: "ENGINEER",
        requiresPasswordChange: false,
        needs2FASetup: true,
        twoFactorVerified: false,
      };
      expect(getAuthGatePath(user)).toBe("/engineering");
    });

    it("redirects MANAGEMENT to /executive when fully authenticated", () => {
      const user: AuthGateUser = {
        role: "MANAGEMENT",
        requiresPasswordChange: false,
        needs2FASetup: false,
        twoFactorVerified: true,
      };
      expect(getAuthGatePath(user)).toBe("/executive");
    });

    it("redirects ENGINEER to /engineering", () => {
      const user: AuthGateUser = {
        role: "ENGINEER",
        requiresPasswordChange: false,
      };
      expect(getAuthGatePath(user)).toBe("/engineering");
    });

    it("redirects CS_AGENT to /dashboard when fully authenticated", () => {
      const user: AuthGateUser = {
        role: "CS_AGENT",
        requiresPasswordChange: false,
        needs2FASetup: false,
        twoFactorVerified: true,
      };
      expect(getAuthGatePath(user)).toBe("/dashboard");
    });

    it("redirects SUPER_ADMIN to /dashboard when fully authenticated", () => {
      const user: AuthGateUser = {
        role: "SUPER_ADMIN",
        requiresPasswordChange: false,
        needs2FASetup: false,
        twoFactorVerified: true,
      };
      expect(getAuthGatePath(user)).toBe("/dashboard");
    });

    it("prioritizes password change over 2FA requirements", () => {
      const user: AuthGateUser = {
        role: "CS_AGENT",
        requiresPasswordChange: true,
        needs2FASetup: true,
        twoFactorVerified: false,
      };
      expect(getAuthGatePath(user)).toBe("/force-password-change");
    });

    it("prioritizes 2FA setup over 2FA verify", () => {
      const user: AuthGateUser = {
        role: "CS_AGENT",
        requiresPasswordChange: false,
        needs2FASetup: true,
        twoFactorVerified: false,
      };
      expect(getAuthGatePath(user)).toBe("/setup-2fa");
    });
  });

  describe("getAuthGateRedirect", () => {
    it("prepends English locale", () => {
      const user: AuthGateUser = {
        role: "CS_AGENT",
        requiresPasswordChange: false,
        needs2FASetup: false,
        twoFactorVerified: true,
      };
      expect(getAuthGateRedirect("en", user)).toBe("/en/dashboard");
    });

    it("prepends Arabic locale", () => {
      const user: AuthGateUser = {
        role: "MANAGEMENT",
        requiresPasswordChange: false,
        needs2FASetup: false,
        twoFactorVerified: true,
      };
      expect(getAuthGateRedirect("ar", user)).toBe("/ar/executive");
    });

    it("handles password change redirect with locale", () => {
      const user: AuthGateUser = {
        role: "CS_AGENT",
        requiresPasswordChange: true,
      };
      expect(getAuthGateRedirect("en", user)).toBe("/en/force-password-change");
    });

    it("handles 2FA setup redirect with locale", () => {
      const user: AuthGateUser = {
        role: "CS_AGENT",
        requiresPasswordChange: false,
        needs2FASetup: true,
      };
      expect(getAuthGateRedirect("ar", user)).toBe("/ar/setup-2fa");
    });
  });
});
