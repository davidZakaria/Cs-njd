import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { prisma } from "@/lib/prisma";
import { verifyTotp } from "@/lib/two-factor";

export async function verifyTwoFactorCode(token: string): Promise<ActionResult> {
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
    select: { twoFactorSecret: true, is2FAEnabled: true },
  });

  if (!user?.twoFactorSecret || !user.is2FAEnabled) {
    return actionFail("NOT_CONFIGURED");
  }

  if (!verifyTotp(normalized, user.twoFactorSecret)) {
    return actionFail("INVALID_CODE");
  }

  return actionOk();
}

export async function resetTwoFactorSetupForSession(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return actionFail("SESSION_EXPIRED");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { is2FAEnabled: false, twoFactorSecret: null },
  });

  return actionOk();
}
