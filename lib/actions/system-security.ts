"use server";

import { revalidatePath } from "next/cache";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { basePrisma, prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/prisma/record-audit-log";

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

  const headersList = await headers();
  const ipAddress =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  await recordAuditLog(basePrisma, { userId: session.user.id, ipAddress }, {
    model: "User",
    action: "SESSION_REVOKE",
    recordId: userId,
    newData: { sessionVersion: { changed: true } },
  });

  revalidatePath("/system/security");
  return actionOk("Sessions revoked");
}
