"use server";

import { auth } from "@/lib/auth";
import { prisma, auditContext } from "@/lib/prisma";
import {
  buildOtpAuthUrl,
  generateQrDataUrl,
  generateTwoFactorSecret,
  verifyTotp,
} from "@/lib/two-factor";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

async function withAudit<T>(fn: () => Promise<T>) {
  const session = await auth();
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";
  return auditContext.run(
    { userId: session?.user?.id, ipAddress: ip },
    fn
  );
}

/** Super Admin: enable or reset a user's 2FA (disable clears secret — user re-enrolls on login). */
export async function setUserTwoFactorByAdmin(
  userId: string,
  enabled: boolean
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return actionFail("Unauthorized");
  }

  if (session.user.id === userId) {
    return actionFail("Cannot change your own 2FA here");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      is2FAEnabled: true,
      twoFactorSecret: true,
    },
  });

  if (!user) return actionFail("User not found");

  if (enabled) {
    if (!user.twoFactorSecret) {
      return actionFail(
        "This user has not completed 2FA setup. They must enroll on next login."
      );
    }
    if (user.is2FAEnabled) return actionOk();

    await withAudit(() =>
      prisma.user.update({
        where: { id: userId },
        data: { is2FAEnabled: true },
      })
    );
  } else {
    if (!user.is2FAEnabled && !user.twoFactorSecret) {
      return actionOk();
    }

    await withAudit(() =>
      prisma.user.update({
        where: { id: userId },
        data: { is2FAEnabled: false, twoFactorSecret: null },
      })
    );
  }

  revalidatePath("/users");
  return actionOk();
}

export async function resetMy2FASetup(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return actionFail("Unauthorized");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { is2FAEnabled: false, twoFactorSecret: null },
  });

  return actionOk();
}

export async function getSetup2FAData(): Promise<
  ActionResult & { secret?: string; qrDataUrl?: string }
> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return actionFail("Unauthorized");
  }

  let user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { is2FAEnabled: true, twoFactorSecret: true, email: true },
  });

  if (!user) return actionFail("User not found");

  // Stuck state: user is on setup but DB says enabled — allow fresh setup.
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
    return actionFail("Setup expired. Tap Start over and scan the QR code again.");
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
