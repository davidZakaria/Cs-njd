import type { JWT } from "@auth/core/jwt";

import { prisma } from "@/lib/prisma";

import { SESSION_REVOKED_ERROR } from "@/lib/auth/session-constants";

export { SESSION_REVOKED_ERROR };

function deriveNeeds2FASetup(
  is2FAEnabled: boolean,
  twoFactorSecret: string | null
) {
  return !is2FAEnabled || !twoFactorSecret;
}

export async function applySessionVersionToToken(token: JWT): Promise<JWT> {
  if (!token.id) return token;

  const dbUser = await prisma.user.findUnique({
    where: { id: String(token.id) },
    select: {
      sessionVersion: true,
      deletedAt: true,
      role: true,
      is2FAEnabled: true,
      requiresPasswordChange: true,
      twoFactorSecret: true,
    },
  });

  if (!dbUser || dbUser.deletedAt) {
    return { ...token, error: SESSION_REVOKED_ERROR };
  }

  const needs2FASetup = deriveNeeds2FASetup(
    dbUser.is2FAEnabled,
    dbUser.twoFactorSecret
  );

  const tokenVersion =
    typeof token.sessionVersion === "number" ? token.sessionVersion : null;

  const synced = {
    sessionVersion: dbUser.sessionVersion,
    role: dbUser.role,
    is2FAEnabled: dbUser.is2FAEnabled,
    requiresPasswordChange: dbUser.requiresPasswordChange,
    needs2FASetup,
    error: undefined as string | undefined,
  };

  if (tokenVersion == null) {
    return {
      ...token,
      ...synced,
      twoFactorVerified: needs2FASetup ? false : token.twoFactorVerified,
    };
  }

  if (tokenVersion !== dbUser.sessionVersion) {
    return { ...token, error: SESSION_REVOKED_ERROR };
  }

  return {
    ...token,
    ...synced,
    twoFactorVerified: needs2FASetup
      ? false
      : token.twoFactorVerified,
  };
}
