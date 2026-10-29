import type { OfficialDocumentType, UnitRequestType } from "@prisma/client";

import { DOCUMENT_TYPE_REQUIRES_APPROVED_REQUEST } from "@/lib/official-documents/types";

export function requiredRequestTypeForDocument(
  documentType: OfficialDocumentType
): UnitRequestType | null {
  return DOCUMENT_TYPE_REQUIRES_APPROVED_REQUEST[documentType] ?? null;
}

export function documentTypeMatchesRequest(
  documentType: OfficialDocumentType,
  requestType: UnitRequestType
): boolean {
  const required = requiredRequestTypeForDocument(documentType);
  return required === null || required === requestType;
}
