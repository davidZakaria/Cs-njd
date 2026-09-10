import { describe, it, expect } from "vitest";
import type { Role } from "@prisma/client";
import type { JWT } from "@auth/core/jwt";
import type { Session } from "next-auth";

import {
  applyJwtUserFields,
  applyJwtClientUpdate,
  buildSessionFromToken,
} from "@/lib/auth/jwt-session-callbacks";
import { SESSION_REVOKED_ERROR } from "@/lib/auth/session-constants";

describe("JWT Session Callbacks", () => {
  describe("applyJwtUserFields", () => {
    it("applies user fields to JWT token", () => {
      const token = {} as JWT;
      const user = {
        id: "user-1",
        role: "CS_AGENT" as Role,
        is2FAEnabled: true,
        needs2FASetup: false,
        twoFactorVerified: true,
        requiresPasswordChange: false,
        sessionVersion: 1,
      };

      const result = applyJwtUserFields(token, user);

      expect(result.id).toBe("user-1");
      expect(result.role).toBe("CS_AGENT");
      expect(result.is2FAEnabled).toBe(true);
      expect(result.needs2FASetup).toBe(false);
      expect(result.twoFactorVerified).toBe(true);
      expect(result.requiresPasswordChange).toBe(false);
      expect(result.sessionVersion).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it("preserves existing token fields", () => {
      const token = {
        sub: "original-sub",
        name: "Test User",
        email: "test@example.com",
      } as JWT;
      const user = {
        id: "user-1",
        role: "MANAGEMENT" as Role,
        is2FAEnabled: true,
        needs2FASetup: false,
        twoFactorVerified: true,
        requiresPasswordChange: false,
        sessionVersion: 2,
      };

      const result = applyJwtUserFields(token, user);

      expect(result.sub).toBe("original-sub");
      expect(result.name).toBe("Test User");
      expect(result.email).toBe("test@example.com");
      expect(result.id).toBe("user-1");
    });

    it("clears any previous error", () => {
      const token = {
        error: "some-error",
      } as JWT;
      const user = {
        id: "user-1",
        role: "SUPER_ADMIN" as Role,
        is2FAEnabled: true,
        needs2FASetup: false,
        twoFactorVerified: true,
        requiresPasswordChange: false,
        sessionVersion: 1,
      };

      const result = applyJwtUserFields(token, user);

      expect(result.error).toBeUndefined();
    });
  });

  describe("applyJwtClientUpdate", () => {
    it("returns token unchanged when session is undefined", () => {
      const token: JWT = {
        id: "user-1",
        role: "CS_AGENT",
        is2FAEnabled: false,
        needs2FASetup: true,
        twoFactorVerified: false,
        requiresPasswordChange: true,
      };

      const result = applyJwtClientUpdate(token, undefined);

      expect(result).toEqual(token);
    });

    it("updates needs2FASetup from session", () => {
      const token: JWT = {
        id: "user-1",
        role: "CS_AGENT",
        is2FAEnabled: false,
        needs2FASetup: true,
        twoFactorVerified: false,
        requiresPasswordChange: false,
      };
      const session = { needs2FASetup: false };

      const result = applyJwtClientUpdate(token, session);

      expect(result.needs2FASetup).toBe(false);
    });

    it("updates twoFactorVerified from session", () => {
      const token: JWT = {
        id: "user-1",
        role: "CS_AGENT",
        is2FAEnabled: true,
        needs2FASetup: false,
        twoFactorVerified: false,
        requiresPasswordChange: false,
      };
      const session = { twoFactorVerified: true };

      const result = applyJwtClientUpdate(token, session);

      expect(result.twoFactorVerified).toBe(true);
    });

    it("updates is2FAEnabled from session", () => {
      const token: JWT = {
        id: "user-1",
        role: "CS_AGENT",
        is2FAEnabled: false,
        needs2FASetup: false,
        twoFactorVerified: true,
        requiresPasswordChange: false,
      };
      const session = { is2FAEnabled: true };

      const result = applyJwtClientUpdate(token, session);

      expect(result.is2FAEnabled).toBe(true);
    });

    it("updates requiresPasswordChange from session", () => {
      const token: JWT = {
        id: "user-1",
        role: "CS_AGENT",
        is2FAEnabled: true,
        needs2FASetup: false,
        twoFactorVerified: true,
        requiresPasswordChange: true,
      };
      const session = { requiresPasswordChange: false };

      const result = applyJwtClientUpdate(token, session);

      expect(result.requiresPasswordChange).toBe(false);
    });

    it("preserves token values when session values are undefined", () => {
      const token: JWT = {
        id: "user-1",
        role: "CS_AGENT",
        is2FAEnabled: true,
        needs2FASetup: false,
        twoFactorVerified: true,
        requiresPasswordChange: false,
      };
      const session = {};

      const result = applyJwtClientUpdate(token, session);

      expect(result.is2FAEnabled).toBe(true);
      expect(result.needs2FASetup).toBe(false);
      expect(result.twoFactorVerified).toBe(true);
      expect(result.requiresPasswordChange).toBe(false);
    });
  });

  describe("buildSessionFromToken", () => {
    it("returns revoked session when token has SESSION_REVOKED_ERROR", () => {
      const session = {
        user: {
          id: "user-1",
          email: "test@example.com",
          name: "Test User",
        },
        expires: new Date().toISOString(),
      } as Session;
      const token = {
        error: SESSION_REVOKED_ERROR,
      } as JWT;

      const result = buildSessionFromToken(session, token);

      expect(result.user).toBeUndefined();
      expect(result.error).toBe(SESSION_REVOKED_ERROR);
    });

    it("returns session unchanged when token has no id", () => {
      const session = {
        user: {
          id: "",
          email: "test@example.com",
          name: "Test User",
        },
        expires: new Date().toISOString(),
      } as Session;
      const token = {} as JWT;

      const result = buildSessionFromToken(session, token);

      expect(result).toEqual(session);
    });

    it("populates session user from token", () => {
      const session = {
        user: {
          id: "",
          email: "test@example.com",
          name: "Test User",
        },
        expires: new Date().toISOString(),
      } as unknown as Session;
      const token: JWT = {
        id: "user-1",
        role: "MANAGEMENT",
        is2FAEnabled: true,
        needs2FASetup: false,
        twoFactorVerified: true,
        requiresPasswordChange: false,
        sessionVersion: 3,
      };

      const result = buildSessionFromToken(session, token);

      expect(result.user.id).toBe("user-1");
      expect(result.user.role).toBe("MANAGEMENT");
      expect(result.user.is2FAEnabled).toBe(true);
      expect(result.user.needs2FASetup).toBe(false);
      expect(result.user.twoFactorVerified).toBe(true);
      expect(result.user.requiresPasswordChange).toBe(false);
      expect(result.user.sessionVersion).toBe(3);
    });
  });
});

describe("Session Constants", () => {
  it("exports SESSION_REVOKED_ERROR", async () => {
    const { SESSION_REVOKED_ERROR } = await import("@/lib/auth/session-constants");
    expect(SESSION_REVOKED_ERROR).toBe("SessionRevoked");
  });

  it("exports session age constants", async () => {
    const {
      SESSION_MAX_AGE_SECONDS,
      SESSION_UPDATE_AGE_SECONDS,
    } = await import("@/lib/auth/session-constants");
    
    expect(typeof SESSION_MAX_AGE_SECONDS).toBe("number");
    expect(typeof SESSION_UPDATE_AGE_SECONDS).toBe("number");
    expect(SESSION_MAX_AGE_SECONDS).toBeGreaterThan(0);
    expect(SESSION_UPDATE_AGE_SECONDS).toBeGreaterThan(0);
  });

  it("buildSessionCookieOptions returns valid cookie options", async () => {
    const { buildSessionCookieOptions } = await import("@/lib/auth/session-constants");
    
    const options = buildSessionCookieOptions();
    
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(typeof options.secure).toBe("boolean");
  });
});
