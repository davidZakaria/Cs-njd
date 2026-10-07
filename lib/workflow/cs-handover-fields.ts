import type { HandoverChecklistInput } from "@/lib/validations/workflow";

/** Checklist fields CS agents may update on their assigned units. */
export const CS_HANDOVER_CHECKLIST_FIELDS = [
  "hasSignedProtocol",
  "signedProtocolDate",
  "hasSignedExtension",
  "signedExtensionDate",
  "papersReceived",
  "powerOfAttorneyReceived",
  "inspectionDate",
  "siteVisitDone",
  "siteVisitDate1",
  "siteVisitDate2",
  "siteVisitDate3",
  "clientInspectionNotes",
  "dhlSentToClient",
  "dhlSentToClientDate",
  "dhlReceivedFromClient",
  "dhlReceivedFromClientDate",
  "paperHandoverPreliminaryCopy",
  "paperHandoverOriginalProtocol",
  "paperHandoverFinishingPapers",
  "paperHandoverKeyReceived",
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
  if (
    field === "inspectionDate" ||
    field === "signedProtocolDate" ||
    field === "signedExtensionDate" ||
    field === "siteVisitDate1" ||
    field === "siteVisitDate2" ||
    field === "siteVisitDate3" ||
    field === "dhlSentToClientDate" ||
    field === "dhlReceivedFromClientDate"
  ) {
    const prevLabel = formatDateLabel(previous);
    const nextLabel = formatDateLabel(next);
    if (prevLabel === nextLabel) return null;
    return `${label}: ${prevLabel} → ${nextLabel}`;
  }

  if (field === "clientInspectionNotes") {
    const prevText = formatTextLabel(previous);
    const nextText = formatTextLabel(next);
    if (prevText === nextText) return null;
    return `${label}: updated`;
  }

  const prevBool = Boolean(previous);
  const nextBool = Boolean(next);
  if (prevBool === nextBool) return null;
  return `${label}: ${prevBool ? "Yes" : "No"} → ${nextBool ? "Yes" : "No"}`;
}

const HANDOVER_FIELD_LABELS: Record<CsHandoverChecklistField, string> = {
  hasSignedProtocol: "Handover record signed",
  signedProtocolDate: "Handover record dated",
  hasSignedExtension: "Sale contract annex signed",
  signedExtensionDate: "Sale contract annex dated",
  papersReceived: "All original papers received",
  powerOfAttorneyReceived: "Power of attorney / DHL received",
  inspectionDate: "Next site inspection date",
  siteVisitDone: "Site visit done",
  siteVisitDate1: "Site visit date (1st)",
  siteVisitDate2: "Site visit date (2nd)",
  siteVisitDate3: "Site visit date (3rd)",
  clientInspectionNotes: "Client notes after inspection",
  dhlSentToClient: "DHL sent to client",
  dhlSentToClientDate: "DHL sent to client date",
  dhlReceivedFromClient: "DHL received from client",
  dhlReceivedFromClientDate: "DHL received from client date",
  paperHandoverPreliminaryCopy: "Copy of preliminary contract given",
  paperHandoverOriginalProtocol: "Original handover record received",
  paperHandoverFinishingPapers: "Finishing papers handed over",
  paperHandoverKeyReceived: "Key handover",
};

function formatDateLabel(value: unknown): string {
  if (!value) return "Not set";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toISOString().slice(0, 10);
}

function formatTextLabel(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
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
