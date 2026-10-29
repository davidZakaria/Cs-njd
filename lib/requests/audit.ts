import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function recordRequestAuditEvent(input: {
  requestId: string;
  userId?: string | null;
  action: string;
  details?: Prisma.InputJsonValue;
}) {
  await prisma.requestAuditEvent.create({
    data: {
      requestId: input.requestId,
      userId: input.userId ?? null,
      action: input.action,
      details: input.details ?? undefined,
    },
  });
}
