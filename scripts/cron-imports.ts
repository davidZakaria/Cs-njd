/**
 * Smoke-import modules used by scripts/cron.ts under Node/tsx (not Next.js).
 * Must not throw from `server-only` or other Next-only guards.
 */
import "dotenv/config";
import { getBackupCronSchedule } from "../lib/backup/run-full-backup";
import { getUnitCycleCronSchedule } from "../lib/unit-cycle/escalation";
import {
  getRequestEscalationCronSchedule,
  runRequestEscalationJob,
} from "../lib/requests/escalation";
import {
  getArchiveGapEscalationCronSchedule,
  runArchiveCheckGapEscalationJob,
} from "../lib/archive-check/escalation";

void getBackupCronSchedule;
void getUnitCycleCronSchedule;
void getRequestEscalationCronSchedule;
void runRequestEscalationJob;
void getArchiveGapEscalationCronSchedule;
void runArchiveCheckGapEscalationJob;

console.log("[cron-imports] ok");
