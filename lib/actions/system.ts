"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getBackupDirectory,
  runDatabaseBackup,
} from "@/lib/backup/run-database-backup";
import { revalidatePath } from "next/cache";
import fs from "fs/promises";
import path from "path";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";

export async function triggerBackupAction(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return actionFail("Unauthorized");
  }

  const backupDir = getBackupDirectory();
  await fs.mkdir(backupDir, { recursive: true });

  const filename = `njd-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;
  const filepath = path.join(backupDir, filename);

  const log = await prisma.backupLog.create({
    data: { filename, status: "IN_PROGRESS" },
  });

  try {
    await runDatabaseBackup(filepath);
    const stat = await fs.stat(filepath);
    await prisma.backupLog.update({
      where: { id: log.id },
      data: { status: "SUCCESS", size: stat.size },
    });
  } catch (error) {
    await prisma.backupLog.update({
      where: { id: log.id },
      data: { status: "FAILED" },
    });
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
