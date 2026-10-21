"use server";

import { auth } from "@/lib/auth";
import { withAudit } from "@/lib/audit/with-audit";
import { auditContext } from "@/lib/prisma/audit-context";
import { basePrisma, prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/prisma/record-audit-log";
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

async function recordTwoFactorResetAudit(
  userId: string,
  userBefore: { is2FAEnabled: boolean; twoFactorSecret: string | null }
) {
  const ctx = auditContext.getStore();
  if (!ctx?.userId) return;

  await recordAuditLog(basePrisma, ctx, {
    model: "User",
    action: "TWO_FACTOR_RESET",
    recordId: userId,
    oldData: {
      is2FAEnabled: userBefore.is2FAEnabled,
      hadTwoFactorSecret: Boolean(userBefore.twoFactorSecret),
    },
    newData: {
      is2FAEnabled: false,
      twoFactorSecret: null,
    },
  });
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
      await basePrisma.user.update({
        where: { id: userId },
        data: { is2FAEnabled: false, twoFactorSecret: null },
      });

      await recordTwoFactorResetAudit(userId, user);
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
  const userBefore = await prisma.user.findUnique({
    where: { id: userId },
    select: { is2FAEnabled: true, twoFactorSecret: true },
  });
  if (!userBefore) {
    return actionFail("User not found");
  }

  const result = await approveTwoFactorResetRequest(userId);
  if (!result.success) {
    return result;
  }

  await withAudit(async () => {
    await recordTwoFactorResetAudit(userId, userBefore);
  });

  revalidatePath("/users");
  revalidatePath("/users/2fa-requests");
  revalidatePath(`/users/2fa-reset/${userId}`);
  return result;
}

export async function rejectUser2FAResetRequest(
  userId: string
): Promise<ActionResult> {
  const result = await rejectTwoFactorResetRequest(userId);
  if (result.success) {
    revalidatePath("/users");
    revalidatePath("/users/2fa-requests");
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
