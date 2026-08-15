"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTwoFactorSecret, generateQrDataUrl, verifyTotp } from "@/lib/two-factor";
import { signIn } from "@/lib/auth";

export async function getSetup2FAData() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const { secret, otpauth } = generateTwoFactorSecret(session.user.email);
  const qrDataUrl = await generateQrDataUrl(otpauth);

  return { secret, qrDataUrl };
}

export async function confirmSetup2FA(secret: string, token: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  if (!verifyTotp(token, secret)) {
    return { success: false, error: "Invalid code" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      twoFactorSecret: secret,
      is2FAEnabled: true,
    },
  });

  return { success: true };
}

export async function verify2FA(token: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.twoFactorSecret) return { success: false, error: "2FA not configured" };

  if (!verifyTotp(token, user.twoFactorSecret)) {
    return { success: false, error: "Invalid code" };
  }

  return { success: true };
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    return { success: true };
  } catch {
    return { success: false, error: "Invalid credentials" };
  }
}
