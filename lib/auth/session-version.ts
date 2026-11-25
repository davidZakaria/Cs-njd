import type { JWT } from "@auth/core/jwt";

import { prisma } from "@/lib/prisma";

import { SESSION_REVOKED_ERROR } from "@/lib/auth/session-constants";
import { userNeedsTwoFactorEnrollment } from "@/lib/auth/two-factor-enrollment";
import { isTwoFactorVerifiedForUser } from "@/lib/auth/two-factor-verified";
import { engineerSessionFlags, isTwoFactorRequired } from "@/lib/auth/two-factor-policy";

export { SESSION_REVOKED_ERROR };

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

  const needs2FASetup = isTwoFactorRequired(dbUser.role)
    ? userNeedsTwoFactorEnrollment(dbUser)
    : false;

  const engineerFlags = engineerSessionFlags(dbUser.role);

  const tokenVersion =
    typeof token.sessionVersion === "number" ? token.sessionVersion : null;

  let twoFactorVerified = false;
  if (engineerFlags) {
    twoFactorVerified = true;
  } else if (!needs2FASetup && isTwoFactorRequired(dbUser.role)) {
    twoFactorVerified = await isTwoFactorVerifiedForUser(String(token.id));
  }

  const synced = {
    sessionVersion: dbUser.sessionVersion,
    role: dbUser.role,
    is2FAEnabled: engineerFlags?.is2FAEnabled ?? dbUser.is2FAEnabled,
    requiresPasswordChange: dbUser.requiresPasswordChange,
    needs2FASetup: engineerFlags?.needs2FASetup ?? needs2FASetup,
    twoFactorVerified,
    error: undefined as string | undefined,
  };

  if (tokenVersion == null) {
    return {
      ...token,
      ...synced,
    };
  }

  if (tokenVersion !== dbUser.sessionVersion) {
    return { ...token, error: SESSION_REVOKED_ERROR };
  }

  return {
    ...token,
    ...synced,
  };
}