"use server";

import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STAFF_DEFAULT_PASSWORD } from "@/lib/staff";

const MIN_PASSWORD_LENGTH = 8;

export async function forcePasswordChange(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" as const };
  }

  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: "tooShort" as const };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "mismatch" as const };
  }

  if (newPassword === STAFF_DEFAULT_PASSWORD) {
    return { success: false, error: "defaultPassword" as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });

  if (!user) {
    return { success: false, error: "unauthorized" as const };
  }

  const sameAsCurrent = await bcrypt.compare(newPassword, user.password);
  if (sameAsCurrent) {
    return { success: false, error: "sameAsCurrent" as const };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      password: passwordHash,
      requiresPasswordChange: false,
    },
  });

  return { success: true as const };
}
