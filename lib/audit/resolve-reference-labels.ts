import {
  auditReferenceLabelKey,
  type AuditReferenceEntity,
  type AuditReferenceLabels,
  AUDIT_REFERENCE_FIELD_SETS,
  isIdLikeAuditValue,
} from "@/lib/audit/reference-field-display";
import { prisma } from "@/lib/prisma";

function unknownLabel(locale: "en" | "ar"): string {
  return locale === "ar" ? "غير معروف" : "Unknown";
}

function deletedUserLabel(locale: "en" | "ar"): string {
  return locale === "ar" ? "مستخدم محذوف" : "Deleted user";
}

function collectReferenceIds(
  snapshots: Array<Record<string, unknown> | null | undefined>,
  buckets: Record<AuditReferenceEntity, Set<string>>
) {
  const {
    USER_REF_FIELDS,
    UNIT_REF_FIELDS,
    PROJECT_REF_FIELDS,
    CLIENT_REF_FIELDS,
    TICKET_REF_FIELDS,
  } = AUDIT_REFERENCE_FIELD_SETS;

  for (const snapshot of snapshots) {
    if (!snapshot) continue;
    for (const [fieldKey, raw] of Object.entries(snapshot)) {
      if (!isIdLikeAuditValue(raw)) continue;
      if (USER_REF_FIELDS.has(fieldKey)) {
        buckets.User.add(raw);
      } else if (UNIT_REF_FIELDS.has(fieldKey)) {
        buckets.Unit.add(raw);
      } else if (PROJECT_REF_FIELDS.has(fieldKey)) {
        buckets.Project.add(raw);
      } else if (CLIENT_REF_FIELDS.has(fieldKey)) {
        buckets.Client.add(raw);
      } else if (TICKET_REF_FIELDS.has(fieldKey)) {
        buckets.Ticket.add(raw);
      }
    }
  }
}

export async function resolveAuditReferenceLabels(
  snapshots: Array<Record<string, unknown> | null | undefined>,
  locale: "en" | "ar"
): Promise<AuditReferenceLabels> {
  const buckets: Record<AuditReferenceEntity, Set<string>> = {
    User: new Set(),
    Unit: new Set(),
    Project: new Set(),
    Client: new Set(),
    Ticket: new Set(),
  };

  collectReferenceIds(snapshots, buckets);
  const out: AuditReferenceLabels = new Map();

  const userIds = [...buckets.User];
  if (userIds.length) {
    const rows = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, deletedAt: true },
    });
    const found = new Map(rows.map((row) => [row.id, row]));
    for (const id of userIds) {
      const row = found.get(id);
      if (!row) {
        out.set(auditReferenceLabelKey("User", id), unknownLabel(locale));
      } else if (row.deletedAt) {
        const base = row.name?.trim() || deletedUserLabel(locale);
        out.set(auditReferenceLabelKey("User", id), base);
      } else {
        out.set(
          auditReferenceLabelKey("User", id),
          row.name?.trim() || unknownLabel(locale)
        );
      }
    }
  }

  const unitIds = [...buckets.Unit];
  if (unitIds.length) {
    const rows = await prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, unitCode: true },
    });
    const found = new Set(rows.map((row) => row.id));
    for (const row of rows) {
      out.set(auditReferenceLabelKey("Unit", row.id), row.unitCode);
    }
    for (const id of unitIds) {
      if (!found.has(id)) {
        out.set(auditReferenceLabelKey("Unit", id), unknownLabel(locale));
      }
    }
  }

  const projectIds = [...buckets.Project];
  if (projectIds.length) {
    const rows = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    });
    const found = new Set(rows.map((row) => row.id));
    for (const row of rows) {
      out.set(auditReferenceLabelKey("Project", row.id), row.name);
    }
    for (const id of projectIds) {
      if (!found.has(id)) {
        out.set(auditReferenceLabelKey("Project", id), unknownLabel(locale));
      }
    }
  }

  const clientIds = [...buckets.Client];
  if (clientIds.length) {
    const rows = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
    });
    const found = new Set(rows.map((row) => row.id));
    for (const row of rows) {
      out.set(auditReferenceLabelKey("Client", row.id), row.name);
    }
    for (const id of clientIds) {
      if (!found.has(id)) {
        out.set(auditReferenceLabelKey("Client", id), unknownLabel(locale));
      }
    }
  }

  const ticketIds = [...buckets.Ticket];
  if (ticketIds.length) {
    const rows = await prisma.ticket.findMany({
      where: { id: { in: ticketIds } },
      select: { id: true, unit: { select: { unitCode: true } } },
    });
    const found = new Set(rows.map((row) => row.id));
    for (const row of rows) {
      const code = row.unit?.unitCode ?? row.id.slice(0, 8);
      out.set(
        auditReferenceLabelKey("Ticket", row.id),
        locale === "ar" ? `بلاغ · ${code}` : `Case · ${code}`
      );
    }
    for (const id of ticketIds) {
      if (!found.has(id)) {
        out.set(auditReferenceLabelKey("Ticket", id), unknownLabel(locale));
      }
    }
  }

  return out;
}

export type { AuditReferenceLabels };