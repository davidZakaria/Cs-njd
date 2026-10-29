"use server";

import { revalidatePath } from "next/cache";

import { withAudit } from "@/lib/audit/with-audit";
import { auth } from "@/lib/auth";
import {
  canAccessCsPortfolioDocuments,
  canManageCsPortfolioDocumentFiles,
} from "@/lib/auth/cs-portfolio-document-access";
import { isOperationsRole } from "@/lib/auth/unit-roles";
import { resolveSignedProtocolAccess } from "@/lib/auth/signed-protocol-access";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { auditContext } from "@/lib/prisma/audit-context";
import { basePrisma, prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/prisma/record-audit-log";
import {
  clearContractFlagAfterUpload,
  clearFinishingContractFlagAfterUpload,
  flagsClearedByUnitDocumentUpload,
} from "@/lib/units/clear-contract-flag-on-upload";
import {
  buildUnitDocumentStoredFilename,
  deleteUnitDocumentFile,
  isAllowedUnitDocumentMime,
  type UnitDocumentKind,
  UNIT_DOCUMENT_MAX_BYTES,
  writeUnitDocumentFile,
} from "@/lib/uploads/unit-document-storage";

function parseDocumentType(value: FormDataEntryValue | null): UnitDocumentKind | null {
  if (
    value === "signedContract" ||
    value === "extensionAnnex" ||
    value === "finishingContract"
  ) {
    return value;
  }
  return null;
}

async function loadUnit(unitId: string) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      contractWorkflow: true,
      finishing: true,
    },
  });
}

type UploadAccess =
  | { ok: false; result: ActionResult }
  | {
      ok: true;
      unit: NonNullable<Awaited<ReturnType<typeof loadUnit>>>;
      canReplace: boolean;
    };

function existingStoredName(
  unit: NonNullable<Awaited<ReturnType<typeof loadUnit>>>,
  documentType: UnitDocumentKind
): string | null {
  if (documentType === "finishingContract") {
    return unit.finishing?.finishingContractFile ?? null;
  }
  if (documentType === "signedContract") {
    return unit.contractWorkflow?.signedContractFile ?? null;
  }
  return unit.contractWorkflow?.extensionAnnexFile ?? null;
}

async function assertCanUpload(
  unitId: string,
  documentType: UnitDocumentKind
): Promise<UploadAccess> {
  const session = await auth();
  if (!session?.user) return { ok: false, result: actionFail("Unauthorized") };

  const unit = await loadUnit(unitId);
  if (!unit) return { ok: false, result: actionFail("Unit not found") };

  const role = session.user.role;
  const previous = existingStoredName(unit, documentType);

  if (documentType === "signedContract") {
    const { canUpload } = await resolveSignedProtocolAccess(
      session.user,
      unit.agentId
    );
    if (!canUpload) return { ok: false, result: actionFail("Unauthorized") };
    const canReplace =
      canManageCsPortfolioDocumentFiles(role) && !isOperationsRole(role);
    if (previous && !canReplace) {
      return {
        ok: false,
        result: actionFail(
          "A file is already on record. Only management can replace or remove it."
        ),
      };
    }
    return { ok: true, unit, canReplace };
  }

  if (!canAccessCsPortfolioDocuments(role)) {
    return { ok: false, result: actionFail("Unauthorized") };
  }

  const canReplace = canManageCsPortfolioDocumentFiles(role);
  if (previous && !canReplace) {
    return {
      ok: false,
      result: actionFail(
        "A file is already on record. Only management can replace or remove it."
      ),
    };
  }

  return { ok: true, unit, canReplace };
}

async function recordDocumentUploadAudit(
  unitId: string,
  documentType: UnitDocumentKind,
  storedName: string,
  replaced: boolean
) {
  const ctx = auditContext.getStore();
  if (!ctx?.userId) return;

  const model =
    documentType === "finishingContract" ? "Finishing" : "ContractWorkflow";

  await recordAuditLog(basePrisma, ctx, {
    model,
    action: replaced ? "UPDATE" : "UPDATE",
    recordId: unitId,
    newData: {
      documentType,
      storedName,
      operation: replaced ? "document_replace" : "document_upload",
    },
  });
}

export async function uploadUnitDocument(
  formData: FormData
): Promise<ActionResult & { filePath?: string }> {
  const unitId = String(formData.get("unitId") ?? "").trim();
  const documentType = parseDocumentType(formData.get("documentType"));
  const file = formData.get("file");

  if (!unitId) return actionFail("Unit is required");
  if (!documentType) return actionFail("Invalid document type");
  if (!(file instanceof File)) return actionFail("No file provided");
  if (file.size === 0) return actionFail("File is empty");
  if (file.size > UNIT_DOCUMENT_MAX_BYTES) {
    return actionFail("File exceeds 15 MB limit");
  }
  if (!isAllowedUnitDocumentMime(file.type)) {
    return actionFail("Only PDF or image files (JPG, PNG, WebP) are allowed");
  }

  const access = await assertCanUpload(unitId, documentType);
  if (!access.ok) return access.result;

  const { unit, canReplace } = access;
  const previousStoredName = existingStoredName(unit, documentType);
  const storedName = buildUnitDocumentStoredFilename(unitId, file.name);
  const replaced = Boolean(previousStoredName);

  return withAudit(async () => {
    if (documentType === "finishingContract") {
      await writeUnitDocumentFile(documentType, storedName, file);
      if (canReplace) {
        await deleteUnitDocumentFile(documentType, previousStoredName);
      }

      await prisma.finishing.upsert({
        where: { unitId },
        create: { unitId, finishingContractFile: storedName },
        update: { finishingContractFile: storedName },
      });
    } else {
      await writeUnitDocumentFile(documentType, storedName, file);
      if (canReplace) {
        await deleteUnitDocumentFile(documentType, previousStoredName);
      }

      await prisma.contractWorkflow.upsert({
        where: { unitId },
        create: {
          unitId,
          ...(documentType === "signedContract"
            ? { signedContractFile: storedName }
            : { extensionAnnexFile: storedName }),
        },
        update:
          documentType === "signedContract"
            ? { signedContractFile: storedName }
            : { extensionAnnexFile: storedName },
      });
    }

    await recordDocumentUploadAudit(unitId, documentType, storedName, replaced);

    if (documentType === "finishingContract") {
      await clearFinishingContractFlagAfterUpload(prisma, unitId);
    } else {
      for (const flag of flagsClearedByUnitDocumentUpload(documentType)) {
        await clearContractFlagAfterUpload(prisma, unitId, flag);
      }
    }

    const { markGeneratedDocumentsSignedCopyOnFile } = await import(
      "@/lib/official-documents/finalize"
    );
    await markGeneratedDocumentsSignedCopyOnFile(unitId, documentType);

    revalidatePath(`/units/${unitId}`);
    revalidatePath("/units");
    return { ...actionOk(), filePath: storedName };
  });
}

export async function removeUnitDocument(
  unitId: string,
  documentType: UnitDocumentKind
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  if (isOperationsRole(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const unit = await loadUnit(unitId);
  if (!unit) return actionFail("Unit not found");

  if (documentType === "signedContract") {
    const { canUpload } = await resolveSignedProtocolAccess(
      session.user,
      unit.agentId
    );
    if (!canUpload) return actionFail("Unauthorized");
  } else if (!canManageCsPortfolioDocumentFiles(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const storedName = existingStoredName(unit, documentType);
  if (!storedName) return actionFail("No file on record");

  return withAudit(async () => {
    await deleteUnitDocumentFile(documentType, storedName);

    if (documentType === "finishingContract") {
      await prisma.finishing.update({
        where: { unitId },
        data: { finishingContractFile: null },
      });
    } else {
      await prisma.contractWorkflow.update({
        where: { unitId },
        data:
          documentType === "signedContract"
            ? { signedContractFile: null }
            : { extensionAnnexFile: null },
      });
    }

    const ctx = auditContext.getStore();
    if (ctx?.userId) {
      const model =
        documentType === "finishingContract" ? "Finishing" : "ContractWorkflow";
      await recordAuditLog(basePrisma, ctx, {
        model,
        action: "DELETE",
        recordId: unitId,
        oldData: { documentType, storedName },
        newData: { documentType, storedName: null },
      });
    }

    revalidatePath(`/units/${unitId}`);
    revalidatePath("/units");
    return actionOk();
  });
}
