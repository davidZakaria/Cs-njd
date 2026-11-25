import { prisma } from "@/lib/prisma";

/**
 * Whether the user completed 2FA for the current password login (server-derived).
 * Ignores JWT/client claims.
 */
export async function isTwoFactorVerifiedForUser(userId: string): Promise<boolean> {
  const [lastPasswordOk, lastTwoFactorSuccess] = await Promise.all([
    prisma.loginHistory.findFirst({
      where: { userId, status: "PASSWORD_OK" },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true },
    }),
    prisma.loginHistory.findFirst({
      where: { userId, status: "TWO_FACTOR_SUCCESS" },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true },
    }),
  ]);

  if (!lastPasswordOk?.timestamp) {
    return false;
  }
  if (!lastTwoFactorSuccess?.timestamp) {
    return false;
  }

  return lastTwoFactorSuccess.timestamp > lastPasswordOk.timestamp;
}