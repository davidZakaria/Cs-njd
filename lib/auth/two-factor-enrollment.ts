import { prisma } from "@/lib/prisma";

export type TwoFactorUserState = {
  is2FAEnabled: boolean;
  twoFactorSecret: string | null;
};

/** Latest Super Admin approval that has not yet been consumed by QR enrollment. */
export async function findUnusedApprovedTwoFactorReset(userId: string) {
  return prisma.twoFactorResetRequest.findFirst({
    where: {
      userId,
      status: "APPROVED",
      usedAt: null,
    },
    orderBy: { reviewedAt: "desc" },
    select: {
      id: true,
      reviewedAt: true,
    },
  });
}

/**
 * True when the user must scan a new authenticator before accessing the app.
 * Stale unused approvals are ignored once 2FA is already enabled again.
 */
export function userNeedsTwoFactorEnrollment(user: TwoFactorUserState): boolean {
  if (user.is2FAEnabled && user.twoFactorSecret) {
    return false;
  }
  return !user.is2FAEnabled || !user.twoFactorSecret;
}

export async function userNeedsTwoFactorEnrollmentForId(
  userId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { is2FAEnabled: true, twoFactorSecret: true },
  });
  if (!user) return false;
  return userNeedsTwoFactorEnrollment(user);
}

export async function markTwoFactorResetRequestConsumed(
  userId: string,
  usedAt: Date = new Date()
) {
  const pending = await findUnusedApprovedTwoFactorReset(userId);
  if (!pending) return null;

  await prisma.twoFactorResetRequest.update({
    where: { id: pending.id },
    data: { usedAt },
  });

  return pending.id;
}