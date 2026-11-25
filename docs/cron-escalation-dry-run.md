# Escalation cron dry run

Production crons in `scripts/cron.ts` call `runRequestEscalationJob`, `runUnitCycleEscalationJob`, and `runArchiveCheckGapEscalationJob` in **live** mode (writes + inbox notifications).

For staging or local inspection, use:

```bash
npm run cron:dry-run-escalations
```

This runs the **same selection logic** with `{ dryRun: true }`: no `unitRequest` / stage / gap-task updates, no audit events, and no inbox notification inserts. Output is JSON per job (`preview`) with request ids, unit codes, departments/roles, and user ids that would be notified.

To execute for real (same as scheduled cron):

```bash
npm run cron:dry-run-escalations -- --apply
```