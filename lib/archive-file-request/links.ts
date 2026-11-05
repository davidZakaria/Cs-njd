import type { ArchiveFileKind } from "@prisma/client";

import type { UnitDocumentKind } from "@/lib/uploads/unit-document-constants";

export function archiveFileKindToUnitDocumentKind(
  kind: ArchiveFileKind
): UnitDocumentKind | "nationalId" | null {
  switch (kind) {
    case "CONTRACT":
      return "signedContract";
    case "ANNEX":
      return "extensionAnnex";
    case "NATIONAL_ID":
      return "nationalId";
    case "RECEIPT":
    case "OTHER":
      return null;
    default:
      return null;
  }
}

export function fulfillmentLinkForArchiveFileItem(input: {
  unitId: string;
  requestId: string;
  fileKind: ArchiveFileKind;
  attachmentId?: string | null;
}): string {
  switch (input.fileKind) {
    case "CONTRACT":
      return `/api/units/${input.unitId}/signed-contract`;
    case "ANNEX":
      return `/api/units/${input.unitId}/extension-annex`;
    case "NATIONAL_ID":
      return `/api/units/${input.unitId}/national-id`;
    case "RECEIPT":
    case "OTHER":
      return `/api/unit-requests/${input.requestId}/attachments/${input.attachmentId ?? ""}`;
  }
}

export function unitProfileTabForArchiveFileKind(kind: ArchiveFileKind): string {
  if (kind === "NATIONAL_ID") return "client";
  if (kind === "RECEIPT" || kind === "OTHER") return "legal";
  return "legal";
}
