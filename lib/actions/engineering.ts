"use server";

import { FinishingPhase } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { isUnitInEngineeringQueue } from "@/lib/engineering/queue";
import {
  normalizeFinishingPhases,
  sortPhases,
} from "@/lib/finishing/phases";
import { notifySiteUpdate } from "@/lib/notifications/triggers";
import { auditContext, prisma } from "@/lib/prisma";
import { activeTicketWhere } from "@/lib/prisma";

async function withAudit<T>(fn: () => Promise<T>) {
  const session = await auth();
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";
  return auditContext.run(
    { userId: session?.user?.id, ipAddress: ip },
    fn
  );
}

const returnToCsSchema = z.object({
  unitId: z.string().min(1),
  phases: z.array(z.nativeEnum(FinishingPhase)).min(1),
  modificationsCompleted: z.boolean(),
  engineeringNotes: z.string().optional(),
});

export async function returnToCsAction(
  input: z.infer<typeof returnToCsSchema>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ENGINEER") {
    return actionFail("Unauthorized");
  }

  const parsed = returnToCsSchema.safeParse(input);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { unitId, modificationsCompleted } = parsed.data;
  const phases = normalizeFinishingPhases(parsed.data.phases);
  const legacyPhase = sortPhases(phases).at(-1) ?? "NOT_STARTED";
  const engineeringNotes = String(parsed.data.engineeringNotes ?? "").trim();

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      finishing: true,
      agent: true,
      tickets: {
        where: activeTicketWhere({
          pendingParty: "ENGINEERING",
          status: { not: "RESOLVED" },
        }),
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!unit) return actionFail("Unit not found");

  if (!isUnitInEngineeringQueue(unit)) {
    return actionFail("Unit is not in the engineering queue");
  }

  const activeTicket = unit.tickets[0];
  if (!activeTicket) return actionFail("No active engineering ticket found");

  const engineerName = session.user.name ?? session.user.email ?? "Engineer";
  const timelineNote = engineeringNotes
    ? `🏗️ [Site Update]: Engineering progress updated by ${engineerName}. Notes: ${engineeringNotes}`
    : `🏗️ [Site Update]: Engineering progress updated by ${engineerName}.`;

  await withAudit(async () => {
    await prisma.finishing.upsert({
      where: { unitId },
      create: {
        unitId,
        phases,
        phase: legacyPhase,
        modificationsCompleted,
      },
      update: {
        phases,
        phase: legacyPhase,
        modificationsCompleted,
      },
    });

    await prisma.ticket.update({
      where: { id: activeTicket.id },
      data: {
        engineeringNotes: engineeringNotes || null,
        pendingParty: "CUSTOMER_SERVICE",
      },
    });

    await prisma.ticket.create({
      data: {
        unitId,
        notes: timelineNote,
        status: "PENDING",
        category: "FEEDBACK_HISTORY",
        agentId: session.user.id,
        pendingParty: "NONE",
      },
    });
  });

  if (unit.agentId) {
    await notifySiteUpdate({
      agentUserId: unit.agentId,
      unitCode: unit.unitCode,
      unitId: unit.id,
      engineerName,
    });
  }

  revalidatePath("/engineering");
  revalidatePath(`/engineering/units/${unitId}`);
  revalidatePath(`/units/${unitId}`);
  revalidatePath("/cases");
  revalidatePath("/dashboard");
  return actionOk();
}
