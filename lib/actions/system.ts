"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";

const execFileAsync = promisify(execFile);

export async function triggerBackupAction(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return actionFail("Unauthorized");
  }

  const backupDir = process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups");
  await fs.mkdir(backupDir, { recursive: true });

  const filename = `njd-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;
  const filepath = path.join(backupDir, filename);

  const log = await prisma.backupLog.create({
    data: { filename, status: "IN_PROGRESS" },
  });

  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return actionFail("DATABASE_URL not configured");

    await execFileAsync("pg_dump", [databaseUrl, "-f", filepath], {
      env: process.env,
    });

    const stat = await fs.stat(filepath);
    await prisma.backupLog.update({
      where: { id: log.id },
      data: { status: "SUCCESS", size: stat.size },
    });
  } catch {
    await prisma.backupLog.update({
      where: { id: log.id },
      data: { status: "FAILED" },
    });
    return actionFail("Backup failed");
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
