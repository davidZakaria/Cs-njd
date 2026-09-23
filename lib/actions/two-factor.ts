"use server";

import { auth } from "@/lib/auth";
import { prisma, auditContext } from "@/lib/prisma";
import {
  resetTwoFactorSetupForSession,
  verifyTwoFactorCode,
} from "@/lib/auth/two-factor-session";
import {
  approveTwoFactorResetRequest,
  cancelPendingTwoFactorResetRequests,
  getTwoFactorResetStatusForSession,
  rejectTwoFactorResetRequest,
  requestTwoFactorResetForSession,
} from "@/lib/auth/two-factor-reset-request";
import {
  confirmSetupTwoFactor,
  getSetupTwoFactorData,
} from "@/lib/auth/setup-two-factor";
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

    await withAudit(async () => {
      await cancelPendingTwoFactorResetRequests(userId);
      await prisma.user.update({
        where: { id: userId },
        data: { is2FAEnabled: false, twoFactorSecret: null },
      });
    });
  }

  revalidatePath("/users");
  return actionOk();
}

export async function resetMy2FASetup(): Promise<ActionResult> {
  return resetTwoFactorSetupForSession();
}

export async function requestMy2FAReset(): Promise<ActionResult> {
  return requestTwoFactorResetForSession();
}

export async function getMy2FAResetStatus() {
  return getTwoFactorResetStatusForSession();
}

export async function approveUser2FAResetRequest(
  userId: string
): Promise<ActionResult> {
  const result = await approveTwoFactorResetRequest(userId);
  if (result.success) {
    revalidatePath("/users");
    revalidatePath(`/users/2fa-reset/${userId}`);
  }
  return result;
}

export async function rejectUser2FAResetRequest(
  userId: string
): Promise<ActionResult> {
  const result = await rejectTwoFactorResetRequest(userId);
  if (result.success) {
    revalidatePath("/users");
    revalidatePath(`/users/2fa-reset/${userId}`);
  }
  return result;
}

export async function getSetup2FAData(): Promise<
  ActionResult & { secret?: string; qrDataUrl?: string }
> {
  return getSetupTwoFactorData();
}

export async function confirmSetup2FA(secret: string, token: string) {
  return confirmSetupTwoFactor(secret, token);
}

export async function verify2FA(token: string): Promise<ActionResult> {
  return verifyTwoFactorCode(token);
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
