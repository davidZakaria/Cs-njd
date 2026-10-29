/**
 * Smoke-import modules used by scripts/cron.ts under Node/tsx (not Next.js).
 * Must not throw from `server-only` or other Next-only guards.
 */
import { getBackupCronSchedule } from "../lib/backup/run-full-backup";
import { getUnitCycleCronSchedule } from "../lib/unit-cycle/escalation";
import {
  getRequestEscalationCronSchedule,
  runRequestEscalationJob,
} from "../lib/requests/escalation";

void getBackupCronSchedule;
void getUnitCycleCronSchedule;
void getRequestEscalationCronSchedule;
void runRequestEscalationJob;

console.log("[cron-imports] ok");
