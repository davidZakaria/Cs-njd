import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { recordLoginAttempt } from "@/lib/auth/login-history";
import { prisma } from "@/lib/prisma";
import {
  AUTH_RATE_LIMIT_ERROR,
  authRateLimitKey,
  checkRateLimit,
  clearFailures,
  recordFailure,
} from "@/lib/security/rate-limit";
import { verifyTotp } from "@/lib/two-factor";

async function getClientIpFromHeaders(): Promise<string | undefined> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || undefined;
  }
  return headersList.get("x-real-ip") ?? undefined;
}

async function loginMeta() {
  const headersList = await headers();
  const ipAddress = await getClientIpFromHeaders();
  const userAgent = headersList.get("user-agent") ?? undefined;
  return { ipAddress, userAgent };
}

export async function verifyTwoFactorCode(token: string): Promise<ActionResult> {
  const { ipAddress, userAgent } = await loginMeta();
  const rateLimitKey = authRateLimitKey("2fa", ipAddress);
  const rateCheck = checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    return actionFail(AUTH_RATE_LIMIT_ERROR);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return actionFail("SESSION_EXPIRED");
  }

  const normalized = token.replace(/\D/g, "").trim();
  if (!normalized) {
    return actionFail("CODE_REQUIRED");
  }
  if (normalized.length !== 6) {
    return actionFail("CODE_LENGTH");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      twoFactorSecret: true,
      is2FAEnabled: true,
    },
  });

  if (!user?.twoFactorSecret || !user.is2FAEnabled) {
    return actionFail("NOT_CONFIGURED");
  }

  if (!verifyTotp(normalized, user.twoFactorSecret)) {
    recordFailure(rateLimitKey);
    await recordLoginAttempt({
      email: user.email,
      status: "TWO_FACTOR_FAILED",
      userId: session.user.id,
      ipAddress,
      userAgent,
    });
    return actionFail("INVALID_CODE");
  }

  clearFailures(rateLimitKey);

  await recordLoginAttempt({
    email: user.email,
    status: "TWO_FACTOR_SUCCESS",
    userId: session.user.id,
    ipAddress,
    userAgent,
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastLoginAt: new Date() },
  });

  await recordLoginAttempt({
    email: user.email,
    status: "SUCCESS",
    userId: session.user.id,
    ipAddress,
    userAgent,
  });

  return actionOk();
}

export async function resetTwoFactorSetupForSession(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return actionFail("SESSION_EXPIRED");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { is2FAEnabled: true },
  });

  if (!user) {
    return actionFail("SESSION_EXPIRED");
  }

  if (user.is2FAEnabled) {
    return actionFail("APPROVAL_REQUIRED");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { is2FAEnabled: false, twoFactorSecret: null },
  });

  return actionOk();
}
