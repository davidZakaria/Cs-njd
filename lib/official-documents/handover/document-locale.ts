import type { OfficialDocumentType } from "@prisma/client";

import { handoverUsesOfficialMasters } from "@/lib/official-documents/handover/constants";

/** All customer-facing generated official documents use Arabic templates only. */
export const OFFICIAL_GENERATED_DOCUMENT_LOCALE = "ar" as const;

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
}): typeof OFFICIAL_GENERATED_DOCUMENT_LOCALE {
  void input.documentType;
  void input.projectName;
  void input.requestedLocale;
  return OFFICIAL_GENERATED_DOCUMENT_LOCALE;
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
  return !draft.handoverTemplateKey || draft.templateLocale !== "ar";
}

/** True when the draft body is still the pre-master generic English placeholder. */
export function handoverDraftIsLegacyGenericPlaceholder(body: string): boolean {
  return isLegacyGenericHandoverDraftBody(body);
}
