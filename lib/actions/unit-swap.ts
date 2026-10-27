"use server";

import { revalidatePath } from "next/cache";

import { withAudit } from "@/lib/audit/with-audit";
import { auth } from "@/lib/auth";
import { canSwapUnitClient } from "@/lib/auth/role-permissions";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { auditContext } from "@/lib/prisma/audit-context";
import { basePrisma, prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/prisma/record-audit-log";
import { activeUnitWhere } from "@/lib/prisma";
import {
  assertTargetUnitEmpty,
  buildUnitSwapPreview,
  executeUnitSwapTransaction,
  type UnitSwapPreview,
} from "@/lib/units/unit-swap";

export type SwapTargetUnitResult = {
  unitId: string;
  unitCode: string;
  projectName: string;
};

export async function searchEmptyUnitsForSwap(
  query: string,
  excludeUnitId: string
): Promise<SwapTargetUnitResult[]> {
  const session = await auth();
  if (!session?.user || !canSwapUnitClient(session.user.role)) {
    return [];
  }

  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const units = await prisma.unit.findMany({
    where: {
      ...activeUnitWhere(),
      id: { not: excludeUnitId },
      clientId: null,
      unitClients: { none: {} },
      OR: [
        { unitCode: { contains: trimmed, mode: "insensitive" } },
        { project: { name: { contains: trimmed, mode: "insensitive" } } },
      ],
    },
    include: { project: { select: { name: true } } },
    take: 12,
    orderBy: [{ project: { name: "asc" } }, { unitCode: "asc" }],
  });

  return units.map((u) => ({
    unitId: u.id,
    unitCode: u.unitCode,
    projectName: u.project.name,
  }));
}

export async function getUnitSwapPreview(
  sourceUnitId: string,
  targetUnitId: string
): Promise<ActionResult & { preview?: UnitSwapPreview }> {
  const session = await auth();
  if (!session?.user || !canSwapUnitClient(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const preview = await buildUnitSwapPreview(prisma, sourceUnitId, targetUnitId);
  if (!preview) return actionFail("Unit not found");

  const target = await prisma.unit.findUnique({
    where: { id: targetUnitId },
    include: { unitClients: true },
  });
  if (!target) return actionFail("Target unit not found");
  const emptyError = assertTargetUnitEmpty(target);
  if (emptyError) return actionFail(emptyError);

  return { ...actionOk(), preview };
}

export async function swapUnitClient(
  sourceUnitId: string,
  targetUnitId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !canSwapUnitClient(session.user.role)) {
    return actionFail("Unauthorized");
  }

  if (sourceUnitId === targetUnitId) {
    return actionFail("Source and target unit must be different");
  }

  const preview = await buildUnitSwapPreview(prisma, sourceUnitId, targetUnitId);
  if (!preview) return actionFail("Unit not found");

  const target = await prisma.unit.findUnique({
    where: { id: targetUnitId },
    include: { unitClients: true, project: { select: { name: true } } },
  });
  const source = await prisma.unit.findUnique({
    where: { id: sourceUnitId },
    include: { client: { select: { name: true } }, project: { select: { name: true } } },
  });
  if (!target || !source) return actionFail("Unit not found");

  const emptyError = assertTargetUnitEmpty(target);
  if (emptyError) return actionFail(emptyError);

  const actorName = session.user.name ?? session.user.email ?? "Management";
  const clientName = source.client?.name ?? "Client";
  const swappedAt = new Date();
  const legalTaskNotes = `Review and re-upload contracts for the new unit after client swap from ${source.unitCode}.`;

  return withAudit(async () => {
    await executeUnitSwapTransaction(prisma, {
      sourceUnitId,
      targetUnitId,
      history: {
        sourceUnitId: source.id,
        sourceUnitCode: source.unitCode,
        sourceProjectName: source.project.name,
        targetUnitId: target.id,
        targetUnitCode: target.unitCode,
        targetProjectName: target.project.name,
        clientName,
        actorUserId: session.user.id,
        actorName,
        swappedAt,
      },
      legalTaskNotes,
    });

    const ctx = auditContext.getStore();
    if (ctx?.userId) {
      await recordAuditLog(basePrisma, ctx, {
        model: "Unit",
        action: "UPDATE",
        recordId: sourceUnitId,
        newData: {
          operation: "unit_client_swap",
          sourceUnitId,
          targetUnitId,
          clientName,
        },
      });
    }

    revalidatePath(`/units/${sourceUnitId}`);
    revalidatePath(`/units/${targetUnitId}`);
    revalidatePath("/units");
    return actionOk();
  });
}
