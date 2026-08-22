"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { prisma } from "@/lib/prisma";

export async function killUserSessions(userId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return actionFail("Unauthorized");
  }

  if (userId === session.user.id) {
    return actionFail("Cannot revoke your own active session from this panel.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    return actionFail("User not found");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });

  revalidatePath("/system/security");
  return actionOk("Sessions revoked");
}
