import "dotenv/config";
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import {
  getBackupCronSchedule,
  runFullBackup,
} from "../lib/backup/run-full-backup";

const prisma = new PrismaClient();
const schedule = getBackupCronSchedule();

async function runScheduledBackup() {
  try {
    const { manifest } = await runFullBackup(prisma, "SCHEDULED");
    console.log(
      `[backup-cron] SUCCESS ${manifest.archive.filename} (${manifest.archive.sizeBytes} bytes)`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown backup failure";
    console.error("[backup-cron] FAILED:", message);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }
}

if (!cron.validate(schedule)) {
  console.error(`[backup-cron] Invalid BACKUP_CRON schedule: ${schedule}`);
  process.exit(1);
}

console.log(`[backup-cron] Daily backup scheduled: ${schedule}`);
cron.schedule(schedule, runScheduledBackup);
