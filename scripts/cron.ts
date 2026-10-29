import "dotenv/config";

import cron from "node-cron";

import {
  getBackupCronSchedule,
  runFullBackup,
} from "../lib/backup/run-full-backup";
import {
  getUnitCycleCronSchedule,
  runUnitCycleEscalationJob,
} from "../lib/unit-cycle/escalation";
import {
  getRequestEscalationCronSchedule,
  runRequestEscalationJob,
} from "../lib/requests/escalation";
import { prisma, basePrisma } from "../lib/prisma";

const backupSchedule = getBackupCronSchedule();
const unitCycleSchedule = getUnitCycleCronSchedule();
const requestEscalationSchedule = getRequestEscalationCronSchedule();

async function runScheduledBackup() {
  try {
    const { manifest } = await runFullBackup(basePrisma, "SCHEDULED");
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

async function runScheduledUnitCycleEscalation() {
  try {
    const result = await runUnitCycleEscalationJob(prisma);
    console.log(
      `[unit-cycle-cron] scanned=${result.scanned} notified=${result.notified}`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown unit cycle job failure";
    console.error("[unit-cycle-cron] FAILED:", message);
  }
}

async function runScheduledRequestEscalation() {
  try {
    const result = await runRequestEscalationJob(basePrisma);
    console.log(
      `[request-escalation-cron] scanned=${result.scanned} notified=${result.notified}`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown request escalation failure";
    console.error("[request-escalation-cron] FAILED:", message);
  }
}

for (const [label, schedule] of [
  ["backup-cron", backupSchedule],
  ["unit-cycle-cron", unitCycleSchedule],
  ["request-escalation-cron", requestEscalationSchedule],
] as const) {
  if (!cron.validate(schedule)) {
    console.error(`[${label}] Invalid cron schedule: ${schedule}`);
    process.exit(1);
  }
}

console.log(`[backup-cron] Daily backup scheduled: ${backupSchedule}`);
cron.schedule(backupSchedule, runScheduledBackup);

console.log(
  `[unit-cycle-cron] Overdue escalation scheduled: ${unitCycleSchedule}`
);
cron.schedule(unitCycleSchedule, runScheduledUnitCycleEscalation);

console.log(
  `[request-escalation-cron] Overdue escalation scheduled: ${requestEscalationSchedule}`
);
cron.schedule(requestEscalationSchedule, runScheduledRequestEscalation);
