import type { LoginAttemptStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function recordLoginAttempt(input: {
  email: string;
  status: LoginAttemptStatus;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.loginHistory.create({
      data: {
        email: input.email.toLowerCase(),
        status: input.status,
        userId: input.userId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("[login-history] Failed to record attempt:", error);
  }
}
