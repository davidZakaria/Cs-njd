export type AuditReferenceEntity =
  | "User"
  | "Unit"
  | "Project"
  | "Client"
  | "Ticket";

export type AuditReferenceLabels = Map<string, string>;

export function auditReferenceLabelKey(
  entity: AuditReferenceEntity,
  id: string
): string {
  return `${entity}\0${id}`;
}

const USER_REF_FIELDS = new Set([
  "userId",
  "agentId",
  "createdById",
  "updatedById",
  "assignedToId",
  "assignedAgentId",
  "assignedEngineerId",
  "approvedById",
  "rejectedById",
  "revokedById",
  "uploadedById",
  "resolvedById",
]);

const UNIT_REF_FIELDS = new Set(["unitId"]);
const PROJECT_REF_FIELDS = new Set(["projectId"]);
const CLIENT_REF_FIELDS = new Set(["clientId"]);
const TICKET_REF_FIELDS = new Set([
  "ticketId",
  "activeTicketId",
  "resolvedTicketId",
]);

function isIdLike(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 40;
}

function unknownLabel(locale: "en" | "ar"): string {
  return locale === "ar" ? "غير معروف" : "Unknown";
}

export function resolveAuditReferenceField(
  fieldKey: string,
  value: unknown,
  labels: AuditReferenceLabels | undefined,
  locale: "en" | "ar"
): string | null {
  if (!labels || !isIdLike(value)) return null;

  if (USER_REF_FIELDS.has(fieldKey)) {
    return (
      labels.get(auditReferenceLabelKey("User", value)) ?? unknownLabel(locale)
    );
  }
  if (UNIT_REF_FIELDS.has(fieldKey)) {
    return (
      labels.get(auditReferenceLabelKey("Unit", value)) ?? unknownLabel(locale)
    );
  }
  if (PROJECT_REF_FIELDS.has(fieldKey)) {
    return (
      labels.get(auditReferenceLabelKey("Project", value)) ??
      unknownLabel(locale)
    );
  }
  if (CLIENT_REF_FIELDS.has(fieldKey)) {
    return (
      labels.get(auditReferenceLabelKey("Client", value)) ?? unknownLabel(locale)
    );
  }
  if (TICKET_REF_FIELDS.has(fieldKey)) {
    return (
      labels.get(auditReferenceLabelKey("Ticket", value)) ?? unknownLabel(locale)
    );
  }

  return null;
}

export const AUDIT_REFERENCE_FIELD_SETS = {
  USER_REF_FIELDS,
  UNIT_REF_FIELDS,
  PROJECT_REF_FIELDS,
  CLIENT_REF_FIELDS,
  TICKET_REF_FIELDS,
} as const;

export function isIdLikeAuditValue(value: unknown): value is string {
  return isIdLike(value);
}