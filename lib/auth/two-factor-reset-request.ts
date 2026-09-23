import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { prisma } from "@/lib/prisma";
import { notifyRoles, notifyUser } from "@/lib/services/notifications";

export type TwoFactorResetStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected"
  | "ready";

export async function requestTwoFactorResetForSession(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return actionFail("SESSION_EXPIRED");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, is2FAEnabled: true },
  });

  if (!user?.is2FAEnabled) {
    return actionFail("NOT_CONFIGURED");
  }

  const existing = await prisma.twoFactorResetRequest.findFirst({
    where: { userId: user.id, status: "PENDING" },
    select: { id: true },
  });

  if (!existing) {
    await prisma.twoFactorResetRequest.create({
      data: { userId: user.id },
    });

    await notifyRoles(
      ["SUPER_ADMIN"],
      "2FA reset requested",
      "طلب إعادة ضبط المصادقة الثنائية",
      `${user.name} (${user.email}) requested a new authenticator setup. Approve from Users if legitimate.`,
      `طلب ${user.name} (${user.email}) إعادة ضبط المصادقة الثنائية. وافق من صفحة المستخدمين إذا كان الطلب صحيحًا.`,
      "/users"
    );
  }

  return actionOk();
}

export async function getTwoFactorResetStatusForSession(): Promise<{
  success: true;
  status: TwoFactorResetStatus;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: true, status: "none" };
  }

  const userId = session.user.id;

  const pending = await prisma.twoFactorResetRequest.findFirst({
    where: { userId, status: "PENDING" },
    orderBy: { requestedAt: "desc" },
    select: { id: true },
  });
  if (pending) {
    return { success: true, status: "pending" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { is2FAEnabled: true, twoFactorSecret: true },
  });

  const latestReviewed = await prisma.twoFactorResetRequest.findFirst({
    where: {
      userId,
      status: { in: ["APPROVED", "REJECTED"] },
    },
    orderBy: { reviewedAt: "desc" },
    select: { status: true, reviewedAt: true },
  });

  if (
    latestReviewed?.status === "APPROVED" &&
    user &&
    !user.is2FAEnabled &&
    !user.twoFactorSecret
  ) {
    return { success: true, status: "ready" };
  }

  if (
    latestReviewed?.status === "REJECTED" &&
    latestReviewed.reviewedAt &&
    Date.now() - latestReviewed.reviewedAt.getTime() < 1000 * 60 * 60 * 24
  ) {
    return { success: true, status: "rejected" };
  }

  if (latestReviewed?.status === "APPROVED") {
    return { success: true, status: "approved" };
  }

  return { success: true, status: "none" };
}

async function clearUserTwoFactor(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { is2FAEnabled: false, twoFactorSecret: null },
  });
}

export async function approveTwoFactorResetRequest(
  targetUserId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return actionFail("Unauthorized");
  }

  if (session.user.id === targetUserId) {
    return actionFail("Cannot approve your own request here");
  }

  const pending = await prisma.twoFactorResetRequest.findFirst({
    where: { userId: targetUserId, status: "PENDING" },
    orderBy: { requestedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!pending) {
    return actionFail("NO_PENDING_REQUEST");
  }

  await prisma.$transaction(async (tx) => {
    await tx.twoFactorResetRequest.update({
      where: { id: pending.id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: session.user!.id,
      },
    });

    await tx.user.update({
      where: { id: targetUserId },
      data: { is2FAEnabled: false, twoFactorSecret: null },
    });

    await tx.twoFactorResetRequest.updateMany({
      where: {
        userId: targetUserId,
        status: "PENDING",
        id: { not: pending.id },
      },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: session.user!.id,
      },
    });
  });

  await notifyUser(
    pending.user.id,
    "2FA reset approved",
    "تمت الموافقة على إعادة ضبط المصادقة",
    "Your Super Admin approved a new authenticator setup. Return to the sign-in flow — the page should show a new QR code shortly.",
    "وافق المسؤول على إعادة ضبط المصادقة. ارجع إلى شاشة تسجيل الدخول — ستظهر لك رمز QR جديد قريبًا.",
    "/login"
  );

  return actionOk();
}

export async function rejectTwoFactorResetRequest(
  targetUserId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return actionFail("Unauthorized");
  }

  const pending = await prisma.twoFactorResetRequest.findFirst({
    where: { userId: targetUserId, status: "PENDING" },
    orderBy: { requestedAt: "desc" },
    include: { user: { select: { id: true } } },
  });

  if (!pending) {
    return actionFail("NO_PENDING_REQUEST");
  }

  await prisma.twoFactorResetRequest.update({
    where: { id: pending.id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedById: session.user.id,
    },
  });

  await notifyUser(
    pending.user.id,
    "2FA reset declined",
    "تم رفض طلب إعادة ضبط المصادقة",
    "Your Super Admin declined the authenticator reset request. Contact them if you still need help.",
    "رفض المسؤول طلب إعادة ضبط المصادقة. تواصل معه إذا كنت ما زلت بحاجة للمساعدة."
  );

  return actionOk();
}

export async function cancelPendingTwoFactorResetRequests(userId: string) {
  await prisma.twoFactorResetRequest.updateMany({
    where: { userId, status: "PENDING" },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });
}

export { clearUserTwoFactor };
