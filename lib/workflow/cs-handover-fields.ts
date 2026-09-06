import type { HandoverChecklistInput } from "@/lib/validations/workflow";

/** Checklist fields CS agents may update on their assigned units. */
export const CS_HANDOVER_CHECKLIST_FIELDS = [
  "hasSignedProtocol",
  "hasSignedExtension",
  "papersReceived",
  "powerOfAttorneyReceived",
  "inspectionDate",
] as const;

export type CsHandoverChecklistField = (typeof CS_HANDOVER_CHECKLIST_FIELDS)[number];

export function isCsHandoverField(
  field: string
): field is CsHandoverChecklistField {
  return (CS_HANDOVER_CHECKLIST_FIELDS as readonly string[]).includes(field);
}

export function describeHandoverFieldChange(
  field: CsHandoverChecklistField,
  previous: unknown,
  next: unknown
): string | null {
  if (previous === next) return null;

  const label = HANDOVER_FIELD_LABELS[field];
  if (field === "inspectionDate") {
    const prevLabel = formatDateLabel(previous);
    const nextLabel = formatDateLabel(next);
    if (prevLabel === nextLabel) return null;
    return `${label}: ${prevLabel} → ${nextLabel}`;
  }

  const prevBool = Boolean(previous);
  const nextBool = Boolean(next);
  if (prevBool === nextBool) return null;
  return `${label}: ${prevBool ? "Yes" : "No"} → ${nextBool ? "Yes" : "No"}`;
}

const HANDOVER_FIELD_LABELS: Record<CsHandoverChecklistField, string> = {
  hasSignedProtocol: "Delivery protocol signed",
  hasSignedExtension: "Extension annex signed",
  papersReceived: "All original papers received",
  powerOfAttorneyReceived: "Power of attorney / DHL received",
  inspectionDate: "Next site inspection date",
};

function formatDateLabel(value: unknown): string {
  if (!value) return "Not set";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toISOString().slice(0, 10);
}

export function collectCsHandoverChanges(
  previous: Pick<HandoverChecklistInput, CsHandoverChecklistField>,
  next: Pick<HandoverChecklistInput, CsHandoverChecklistField>
): string[] {
  const changes: string[] = [];
  for (const field of CS_HANDOVER_CHECKLIST_FIELDS) {
    const line = describeHandoverFieldChange(
      field,
      previous[field],
      next[field]
    );
    if (line) changes.push(line);
  }
  return changes;
}
