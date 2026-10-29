import type { OfficialDocumentType } from "@prisma/client";

import type { UnitDocumentKind } from "@/lib/uploads/unit-document-constants";

const SIGNED_UPLOAD_BY_DOCUMENT: Partial<
  Record<OfficialDocumentType, UnitDocumentKind | "signedProtocol">
> = {
  GRACE_PERIOD_ANNEX: "extensionAnnex",
  CONTRACT_AMENDMENT: "signedContract",
  UNIT_SWAP_ADDENDUM: "signedContract",
  FINISHING_CONTRACT_SUMMARY: "finishingContract",
  HANDOVER_RECORD: "signedProtocol",
};

export function signedUploadKindForDocumentType(
  documentType: OfficialDocumentType
): UnitDocumentKind | "signedProtocol" | null {
  return SIGNED_UPLOAD_BY_DOCUMENT[documentType] ?? null;
}

export async function markGeneratedDocumentsSignedCopyOnFile(
  unitId: string,
  uploadKind: UnitDocumentKind | "signedProtocol"
) {
  const { prisma } = await import("@/lib/prisma");
  const now = new Date();

  const types = (
    Object.entries(SIGNED_UPLOAD_BY_DOCUMENT) as [
      OfficialDocumentType,
      UnitDocumentKind | "signedProtocol",
    ][]
  )
    .filter(([, kind]) => kind === uploadKind)
    .map(([type]) => type);

  if (types.length === 0) return;

  await prisma.unitGeneratedDocument.updateMany({
    where: {
      unitId,
      documentType: { in: types },
      signedCopyOnFileAt: null,
    },
    data: { signedCopyOnFileAt: now },
  });
}
