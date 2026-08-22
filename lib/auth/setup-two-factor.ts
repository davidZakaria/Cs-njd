import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { prisma } from "@/lib/prisma";
import {
  buildOtpAuthUrl,
  generateQrDataUrl,
  generateTwoFactorSecret,
  normalizeTotpSecret,
  verifyTotp,
} from "@/lib/two-factor";

async function ensurePendingSetupSecret(
  userId: string,
  email: string
): Promise<string | null> {
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { is2FAEnabled: true, twoFactorSecret: true },
  });

  if (!user) return null;

  if (user.is2FAEnabled) {
    await prisma.user.update({
      where: { id: userId },
      data: { is2FAEnabled: false, twoFactorSecret: null },
    });
    user = { is2FAEnabled: false, twoFactorSecret: null };
  }

  if (user.twoFactorSecret) {
    return user.twoFactorSecret;
  }

  const generated = generateTwoFactorSecret(email);
  const updated = await prisma.user.updateMany({
    where: { id: userId, twoFactorSecret: null },
    data: { twoFactorSecret: generated.secret, is2FAEnabled: false },
  });

  if (updated.count === 0) {
    const refreshed = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true },
    });
    return refreshed?.twoFactorSecret ?? null;
  }

  return generated.secret;
}

export async function getSetupTwoFactorData(): Promise<
  ActionResult & { secret?: string; qrDataUrl?: string }
> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return actionFail("SESSION_EXPIRED");
  }

  const secret = await ensurePendingSetupSecret(
    session.user.id,
    session.user.email
  );

  if (!secret) {
    return actionFail("USER_NOT_FOUND");
  }

  try {
    const otpauth = buildOtpAuthUrl(session.user.email, secret);
    const qrDataUrl = await generateQrDataUrl(otpauth);
    return { success: true, secret, qrDataUrl };
  } catch {
    return actionFail("QR_GENERATION_FAILED");
  }
}

export async function confirmSetupTwoFactor(
  secret: string,
  token: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return actionFail("SESSION_EXPIRED");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorSecret: true, is2FAEnabled: true },
  });

  const dbSecret = user?.twoFactorSecret;
  if (!dbSecret || user.is2FAEnabled) {
    return actionFail("SETUP_EXPIRED");
  }

  if (normalizeTotpSecret(dbSecret) !== normalizeTotpSecret(secret)) {
    return actionFail("SETUP_EXPIRED");
  }

  const normalized = token.replace(/\D/g, "").trim();
  if (!verifyTotp(normalized, dbSecret)) {
    return actionFail("INVALID_CODE");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      is2FAEnabled: true,
    },
  });

  return actionOk();
}
