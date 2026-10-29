import type { OfficialDocumentType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function recordOfficialDocumentAudit(input: {
  unitId?: string | null;
  documentType?: OfficialDocumentType | null;
  templateVersion?: number | null;
  templateLocale?: string | null;
  action: string;
  userId?: string | null;
  details?: Record<string, unknown> | null;
}) {
  await prisma.officialDocumentAuditEvent.create({
    data: {
      unitId: input.unitId ?? null,
      documentType: input.documentType ?? null,
      templateVersion: input.templateVersion ?? null,
      templateLocale: input.templateLocale ?? null,
      action: input.action,
      userId: input.userId ?? null,
      details: input.details ?? undefined,
    },
  });
}
