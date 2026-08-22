import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import type { JWT } from "@auth/core/jwt";

import { SESSION_REVOKED_ERROR } from "@/lib/auth/session-constants";

type JwtUser = {
  id?: string;
  role: Role;
  is2FAEnabled: boolean;
  needs2FASetup: boolean;
  twoFactorVerified: boolean;
  requiresPasswordChange: boolean;
  sessionVersion: number;
};

export function applyJwtUserFields(token: JWT, user: JwtUser): JWT {
  return {
    ...token,
    id: user.id!,
    role: user.role,
    is2FAEnabled: user.is2FAEnabled,
    needs2FASetup: user.needs2FASetup,
    twoFactorVerified: user.twoFactorVerified,
    requiresPasswordChange: user.requiresPasswordChange,
    sessionVersion: user.sessionVersion,
    error: undefined,
  };
}

export function applyJwtClientUpdate(
  token: JWT,
  session: Record<string, unknown> | undefined
): JWT {
  if (!session) return token;

  return {
    ...token,
    needs2FASetup:
      (session.needs2FASetup as boolean | undefined) ?? token.needs2FASetup,
    twoFactorVerified:
      (session.twoFactorVerified as boolean | undefined) ??
      token.twoFactorVerified,
    is2FAEnabled:
      (session.is2FAEnabled as boolean | undefined) ?? token.is2FAEnabled,
    requiresPasswordChange:
      (session.requiresPasswordChange as boolean | undefined) ??
      token.requiresPasswordChange,
  };
}

export function buildSessionFromToken(
  session: Session,
  token: JWT
): Session {
  if (token.error === SESSION_REVOKED_ERROR) {
    return {
      ...session,
      user: undefined,
      error: SESSION_REVOKED_ERROR,
    } as unknown as Session;
  }

  if (!token.id) {
    return session;
  }

  session.user.id = token.id as string;
  session.user.role = token.role as Role;
  session.user.is2FAEnabled = token.is2FAEnabled as boolean;
  session.user.needs2FASetup = token.needs2FASetup as boolean;
  session.user.twoFactorVerified = token.twoFactorVerified as boolean;
  session.user.requiresPasswordChange =
    token.requiresPasswordChange as boolean;
  session.user.sessionVersion = token.sessionVersion as number;
  return session;
}
