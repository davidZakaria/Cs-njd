import type { OfficialDocumentType } from "@prisma/client";

import { actionFail, type ActionResult } from "@/lib/actions/result";
import { prisma } from "@/lib/prisma";
import {
  documentTypeMatchesRequest,
  requiredRequestTypeForDocument,
} from "@/lib/official-documents/request-binding";

/** Generated PDF marked signed-on-file is immutable; block draft save/regenerate from that draft. */
export async function assertOfficialTextDraftMutable(
  draftId: string
): Promise<ActionResult | null> {
  const signed = await prisma.unitGeneratedDocument.findFirst({
    where: {
      textDraftId: draftId,
      signedCopyOnFileAt: { not: null },
    },
    select: { id: true, displayName: true },
  });
  if (signed) {
    return actionFail(
      "This draft is linked to a signed copy on file and cannot be edited or regenerated."
    );
  }
  return null;
}

/** Linked unit request must remain approved for document types that require it. */
export async function assertLinkedUnitRequestAllowsOfficialDocumentMutation(input: {
  unitId: string;
  documentType: OfficialDocumentType;
  unitRequestId: string | null;
}): Promise<ActionResult | null> {
  const requiredType = requiredRequestTypeForDocument(input.documentType);
  if (!requiredType) {
    if (!input.unitRequestId) return null;
    const optional = await prisma.unitRequest.findFirst({
      where: { id: input.unitRequestId, unitId: input.unitId },
      select: { id: true, type: true, status: true },
    });
    if (!optional) {
      return actionFail("Linked request not found for this unit");
    }
    if (!documentTypeMatchesRequest(input.documentType, optional.type)) {
      return actionFail("Linked request type does not match this document");
    }
    return null;
  }

  if (!input.unitRequestId) {
    return actionFail("An approved request is required for this document type");
  }

  const request = await prisma.unitRequest.findFirst({
    where: {
      id: input.unitRequestId,
      unitId: input.unitId,
      type: requiredType,
    },
    select: { status: true },
  });

  if (!request) {
    return actionFail("Linked request must be approved before editing or generating");
  }
  if (request.status !== "APPROVED") {
    return actionFail(
      "Linked request is no longer approved; official document text cannot be changed."
    );
  }
  return null;
}
