import type { JWT } from "@auth/core/jwt";

import { prisma } from "@/lib/prisma";

export const SESSION_REVOKED_ERROR = "SessionRevoked";

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
    },
  });

  if (!dbUser || dbUser.deletedAt) {
    return { ...token, error: SESSION_REVOKED_ERROR };
  }

  const tokenVersion =
    typeof token.sessionVersion === "number" ? token.sessionVersion : null;

  if (tokenVersion == null || tokenVersion !== dbUser.sessionVersion) {
    return { ...token, error: SESSION_REVOKED_ERROR };
  }

  return {
    ...token,
    sessionVersion: dbUser.sessionVersion,
    role: dbUser.role,
    is2FAEnabled: dbUser.is2FAEnabled,
    requiresPasswordChange: dbUser.requiresPasswordChange,
    error: undefined,
  };
}
