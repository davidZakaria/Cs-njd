import "dotenv/config";
import cron from "node-cron";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

const execFileAsync = promisify(execFile);
const prisma = new PrismaClient();

async function runBackup() {
  const backupDir = process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups");
  await fs.mkdir(backupDir, { recursive: true });

  const filename = `njd-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;
  const filepath = path.join(backupDir, filename);
  const log = await prisma.backupLog.create({
    data: { filename, status: "IN_PROGRESS" },
  });

  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL missing");
    await execFileAsync("pg_dump", [databaseUrl, "-f", filepath], { env: process.env });
    const stat = await fs.stat(filepath);
    await prisma.backupLog.update({
      where: { id: log.id },
      data: { status: "SUCCESS", size: stat.size },
    });
    console.log(`Backup completed: ${filename}`);
  } catch (error) {
    await prisma.backupLog.update({
      where: { id: log.id },
      data: { status: "FAILED" },
    });
    console.error("Backup failed:", error);
  }
}

console.log("Starting backup cron (daily at 02:00)...");
cron.schedule("0 2 * * *", runBackup);
runBackup().catch(console.error);
