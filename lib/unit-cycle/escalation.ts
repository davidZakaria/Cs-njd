import { notifyRoles } from "@/lib/services/notifications";
import { getOverdueStagesForManagement, type UnitCycleDb } from "@/lib/unit-cycle/queries";
import { recordUnitCycleAuditEvent } from "@/lib/unit-cycle/audit";

export async function runUnitCycleEscalationJob(
  prisma: UnitCycleDb
): Promise<{ notified: number; scanned: number }> {
  const ESCALATION_COOLDOWN_MS = 20 * 60 * 60 * 1000;
  const overdue = await getOverdueStagesForManagement(prisma, 500);
  const now = new Date();
  let notified = 0;

  for (const row of overdue) {
    const stage = await prisma.unitCycleStage.findFirst({
      where: {
        unitCycleId: row.unitCycleId,
        stageKey: row.stageKey as never,
      },
      select: { id: true, lastEscalatedAt: true },
    });
    if (!stage) continue;

    if (
      stage.lastEscalatedAt &&
      now.getTime() - stage.lastEscalatedAt.getTime() < ESCALATION_COOLDOWN_MS
    ) {
      continue;
    }

    await notifyRoles(
      ["MANAGEMENT", "SUPER_ADMIN"],
      "Overdue unit cycle stage",
      "مرحلة دورة وحدة متأخرة",
      `${row.projectName} · ${row.unitCode} · ${row.stageKey} (${row.daysOverdue}d overdue)`,
      `${row.projectName} · ${row.unitCode} · ${row.stageKey} (متأخر ${row.daysOverdue} يوم)`,
      `/units/${row.unitId}`
    );

    await prisma.unitCycleStage.update({
      where: { id: stage.id },
      data: { lastEscalatedAt: now },
    });

    await recordUnitCycleAuditEvent({
      unitCycleId: row.unitCycleId,
      stageKey: row.stageKey as never,
      action: "escalated_overdue",
      details: { daysOverdue: row.daysOverdue },
    });

    notified += 1;
  }

  return { notified, scanned: overdue.length };
}

export function getUnitCycleCronSchedule(): string {
  return process.env.UNIT_CYCLE_CRON ?? "0 8 * * *";
}
