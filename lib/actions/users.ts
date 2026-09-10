"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { auditContext, prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 8;

async function withAudit<T>(fn: () => Promise<T>) {
  const session = await auth();
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";
  return auditContext.run(
    { userId: session?.user?.id, ipAddress: ip },
    fn
  );
}

export async function adminChangeUserPassword(
  userId: string,
  newPassword: string
): Promise<ActionResult> {
  const session = await auth();
  if (
    !session?.user ||
    !["SUPER_ADMIN", "MANAGEMENT"].includes(session.user.role)
  ) {
    return actionFail("Unauthorized");
  }

  if (session.user.id === userId) {
    return actionFail("Cannot change your own password here");
  }

  const password = newPassword.trim();
  if (password.length < MIN_PASSWORD_LENGTH) {
    return actionFail("Password must be at least 8 characters");
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing || existing.deletedAt) {
    return actionFail("User not found");
  }

  if (existing.role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return actionFail("Cannot modify super admin");
  }

  const hashed = await bcrypt.hash(password, 12);

  await withAudit(() =>
    prisma.user.update({
      where: { id: userId },
      data: {
        password: hashed,
        requiresPasswordChange: false,
        sessionVersion: { increment: 1 },
      },
    })
  );

  revalidatePath("/users");
  return actionOk();
}

export async function toggleUserStatus(
  userId: string,
  isActive: boolean
): Promise<ActionResult> {
  const session = await auth();
  if (
    !session?.user ||
    !["SUPER_ADMIN", "MANAGEMENT"].includes(session.user.role)
  ) {
    return actionFail("Unauthorized");
  }

  if (session.user.id === userId) {
    return actionFail("Cannot change your own account status");
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing || existing.deletedAt) {
    return actionFail("User not found");
  }

  if (existing.role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return actionFail("Cannot modify super admin");
  }

  if (existing.isActive === isActive) {
    return actionOk();
  }

  await withAudit(() =>
    prisma.user.update({
      where: { id: userId },
      data: {
        isActive,
        ...(isActive ? {} : { sessionVersion: { increment: 1 } }),
      },
    })
  );

  revalidatePath("/users");
  return actionOk();
}
