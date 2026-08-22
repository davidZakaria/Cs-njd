import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { prisma } from "@/lib/prisma";
import {
  buildOtpAuthUrl,
  generateQrDataUrl,
  generateTwoFactorSecret,
  verifyTotp,
} from "@/lib/two-factor";

export async function getSetupTwoFactorData(): Promise<
  ActionResult & { secret?: string; qrDataUrl?: string }
> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return actionFail("SESSION_EXPIRED");
  }

  let user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { is2FAEnabled: true, twoFactorSecret: true, email: true },
  });

  if (!user) return actionFail("USER_NOT_FOUND");

  if (user.is2FAEnabled) {
    user = await prisma.user.update({
      where: { id: session.user.id },
      data: { is2FAEnabled: false, twoFactorSecret: null },
      select: { is2FAEnabled: true, twoFactorSecret: true, email: true },
    });
  }

  let secret = user.twoFactorSecret;
  if (!secret) {
    const generated = generateTwoFactorSecret(user.email);
    secret = generated.secret;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorSecret: secret, is2FAEnabled: false },
    });
  }

  try {
    const otpauth = buildOtpAuthUrl(user.email, secret);
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

  if (!user?.twoFactorSecret || user.twoFactorSecret !== secret) {
    return actionFail("SETUP_EXPIRED");
  }

  const normalized = token.replace(/\D/g, "").trim();
  if (!verifyTotp(normalized, secret)) {
    return actionFail("INVALID_CODE");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorSecret: secret,
      is2FAEnabled: true,
    },
  });

  return actionOk();
}
