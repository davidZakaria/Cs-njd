"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildOtpAuthUrl,
  generateQrDataUrl,
  generateTwoFactorSecret,
  verifyTotp,
} from "@/lib/two-factor";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";

export async function getSetup2FAData(): Promise<
  ActionResult & { secret?: string; qrDataUrl?: string }
> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return actionFail("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { is2FAEnabled: true, twoFactorSecret: true, email: true },
  });

  if (!user) return actionFail("User not found");
  if (user.is2FAEnabled) {
    return actionFail("Two-factor authentication is already enabled");
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
    return actionFail("Unable to generate QR code");
  }
}

export async function confirmSetup2FA(secret: string, token: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorSecret: true, is2FAEnabled: true },
  });

  if (!user?.twoFactorSecret || user.twoFactorSecret !== secret) {
    return actionFail("Setup expired. Refresh the page and scan the QR code again.");
  }

  if (user.is2FAEnabled) {
    return actionFail("Two-factor authentication is already enabled");
  }

  if (!verifyTotp(token, secret)) {
    return actionFail("Invalid code");
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

export async function verify2FA(token: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.twoFactorSecret || !user.is2FAEnabled) {
    return actionFail("2FA not configured");
  }

  if (!verifyTotp(token, user.twoFactorSecret)) {
    return actionFail("Invalid code");
  }

  return actionOk();
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const { signIn } = await import("@/lib/auth");
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    return actionOk();
  } catch {
    return actionFail("Invalid credentials");
  }
}
