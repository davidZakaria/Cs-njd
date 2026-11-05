import type { OfficialDocumentType } from "@prisma/client";

import { handoverUsesOfficialMasters } from "@/lib/official-documents/handover/constants";

/** Green Avenue / Jura handover records always use the Arabic legal masters. */
export function usesOfficialHandoverLegalMasters(input: {
  documentType: OfficialDocumentType;
  projectName: string;
}): boolean {
  return (
    input.documentType === "HANDOVER_RECORD" &&
    handoverUsesOfficialMasters(input.projectName)
  );
}

export function resolveOfficialDocumentTemplateLocale(input: {
  documentType: OfficialDocumentType;
  projectName: string;
  requestedLocale: "en" | "ar";
}): "en" | "ar" {
  if (usesOfficialHandoverLegalMasters(input)) {
    return "ar";
  }
  return input.requestedLocale;
}

/** Detect legacy generic English placeholder drafts created before official masters. */
export function isLegacyGenericHandoverDraftBody(body: string): boolean {
  const normalized = body.trimStart();
  return (
    normalized.startsWith("Unit Handover Record") ||
    normalized.startsWith("Handover Record\n") ||
    body.includes("{{primaryOwnerName}}") ||
    body.includes("{{projectName}}")
  );
}

export function handoverDraftNeedsOfficialMasterSync(
  draft: {
    documentType: OfficialDocumentType;
    templateLocale: string;
    handoverTemplateKey: string | null;
    currentBody: string;
  },
  projectName: string
): boolean {
  if (
    !usesOfficialHandoverLegalMasters({
      documentType: draft.documentType,
      projectName,
    })
  ) {
    return false;
  }
  return (
    !draft.handoverTemplateKey ||
    draft.templateLocale !== "ar" ||
    isLegacyGenericHandoverDraftBody(draft.currentBody)
  );
}
