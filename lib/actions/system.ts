"use server";

import { auth } from "@/lib/auth";
import { basePrisma } from "@/lib/prisma";
import { runFullBackup } from "@/lib/backup/run-full-backup";
import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";

export async function triggerBackupAction(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return actionFail("Unauthorized");
  }

  try {
    await runFullBackup(basePrisma, "MANUAL");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Backup failed";
    return actionFail(message);
  }

  revalidatePath("/backups");
  return actionOk();
}

export async function checkUpdatesAction() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }

  return {
    currentVersion: "1.0.0",
    latestVersion: "1.0.0",
    updateAvailable: false,
    message: "System is up to date (mock deployment check).",
  };
}
