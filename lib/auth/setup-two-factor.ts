import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { recordLoginAttempt } from "@/lib/auth/login-history";
import { recordTwoFactorFlowAudit } from "@/lib/auth/two-factor-audit";
import { userNeedsTwoFactorEnrollment } from "@/lib/auth/two-factor-enrollment";
import { prisma } from "@/lib/prisma";
import {
  AUTH_RATE_LIMIT_ERROR,
  checkRateLimit,
  recordFailure,
  userRateLimitKey,
} from "@/lib/security/rate-limit";
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
): Promise<{ secret: string | null; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { is2FAEnabled: true, twoFactorSecret: true },
  });

  if (!user) {
    return { secret: null, error: "USER_NOT_FOUND" };
  }

  if (user.is2FAEnabled && user.twoFactorSecret) {
    return { secret: null, error: "APPROVAL_REQUIRED" };
  }

  if (!userNeedsTwoFactorEnrollment(user)) {
    return { secret: null, error: "SETUP_NOT_ALLOWED" };
  }

  if (user.twoFactorSecret) {
    return { secret: user.twoFactorSecret };
  }

  const generated = generateTwoFactorSecret(email);
  const updated = await prisma.user.updateMany({
    where: {
      id: userId,
      twoFactorSecret: null,
      is2FAEnabled: false,
    },
    data: { twoFactorSecret: generated.secret, is2FAEnabled: false },
  });

  if (updated.count === 0) {
    const refreshed = await prisma.user.findUnique({
      where: { id: userId },
      select: { is2FAEnabled: true, twoFactorSecret: true },
    });
    if (refreshed?.is2FAEnabled && refreshed.twoFactorSecret) {
      return { secret: null, error: "APPROVAL_REQUIRED" };
    }
    return {
      secret: refreshed?.twoFactorSecret ?? null,
      error: refreshed?.twoFactorSecret ? undefined : "SETUP_NOT_ALLOWED",
    };
  }

  await recordTwoFactorFlowAudit(
    "TWO_FACTOR_SECRET_ROTATE",
    userId,
    { generatedPendingSecret: true },
    undefined,
    "User"
  );

  return { secret: generated.secret };
}

export async function getSetupTwoFactorData(): Promise<
  ActionResult & { secret?: string; qrDataUrl?: string }
> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return actionFail("SESSION_EXPIRED");
  }

  const rateKey = userRateLimitKey("2fa-qr", session.user.id);
  if (!checkRateLimit(rateKey).allowed) {
    return actionFail(AUTH_RATE_LIMIT_ERROR);
  }

  const enrollmentAllowed = await userNeedsTwoFactorEnrollmentForSession(
    session.user.id
  );
  if (!enrollmentAllowed) {
    return actionFail("SETUP_NOT_ALLOWED");
  }

  const { secret, error } = await ensurePendingSetupSecret(
    session.user.id,
    session.user.email
  );

  if (error) {
    return actionFail(error);
  }

  if (!secret) {
    return actionFail("USER_NOT_FOUND");
  }

  recordFailure(rateKey);

  try {
    const otpauth = buildOtpAuthUrl(session.user.email, secret);
    const qrDataUrl = await generateQrDataUrl(otpauth);
    return { success: true, secret, qrDataUrl };
  } catch {
    return actionFail("QR_GENERATION_FAILED");
  }
}

async function userNeedsTwoFactorEnrollmentForSession(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { is2FAEnabled: true, twoFactorSecret: true },
  });
  return user ? userNeedsTwoFactorEnrollment(user) : false;
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
    select: { email: true, twoFactorSecret: true, is2FAEnabled: true },
  });

  if (!user) {
    return actionFail("SESSION_EXPIRED");
  }

  const dbSecret = user.twoFactorSecret;
  if (!dbSecret && !user.is2FAEnabled) {
    return actionFail("SETUP_SECRET_CHANGED");
  }

  if (!dbSecret || user.is2FAEnabled) {
    return actionFail("SETUP_EXPIRED");
  }

  if (normalizeTotpSecret(dbSecret) !== normalizeTotpSecret(secret)) {
    return actionFail("SETUP_SECRET_CHANGED");
  }

  const normalized = token.replace(/\D/g, "").trim();
  if (!verifyTotp(normalized, dbSecret)) {
    return actionFail("INVALID_CODE");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user!.id },
      data: {
        is2FAEnabled: true,
      },
    });

    await tx.twoFactorResetRequest.updateMany({
      where: {
        userId: session.user!.id,
        status: "APPROVED",
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
  });

  await recordTwoFactorFlowAudit(
    "TWO_FACTOR_ENROLL",
    session.user.id,
    { is2FAEnabled: true },
    undefined,
    "User"
  );

  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const ipAddress = forwarded
    ? forwarded.split(",")[0]?.trim()
    : headersList.get("x-real-ip");
  const userAgent = headersList.get("user-agent") ?? undefined;

  await recordLoginAttempt({
    email: user.email,
    status: "TWO_FACTOR_SUCCESS",
    userId: session.user.id,
    ipAddress: ipAddress ?? undefined,
    userAgent,
  });

  await recordLoginAttempt({
    email: user.email,
    status: "SUCCESS",
    userId: session.user.id,
    ipAddress: ipAddress ?? undefined,
    userAgent,
  });

  return actionOk();
}

export async function assertSetupTwoFactorAllowed(
  userId: string
): Promise<boolean> {
  return userNeedsTwoFactorEnrollmentForSession(userId);
}