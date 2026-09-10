"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { resolveSignedProtocolAccess } from "@/lib/auth/signed-protocol-access";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { prisma } from "@/lib/prisma";
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
  | { ok: true; unit: NonNullable<Awaited<ReturnType<typeof loadUnit>>> };

async function assertCanUpload(unitId: string): Promise<UploadAccess> {
  const session = await auth();
  if (!session?.user) return { ok: false, result: actionFail("Unauthorized") };

  const unit = await loadUnit(unitId);
  if (!unit) return { ok: false, result: actionFail("Unit not found") };

  const { canUpload } = await resolveSignedProtocolAccess(
    session.user,
    unit.agentId
  );
  if (!canUpload) return { ok: false, result: actionFail("Unauthorized") };

  return { ok: true, unit };
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

  const access = await assertCanUpload(unitId);
  if (!access.ok) return access.result;

  const { unit } = access;
  const buffer = Buffer.from(await file.arrayBuffer());
  const storedName = buildUnitDocumentStoredFilename(unitId, file.name);

  if (documentType === "finishingContract") {
    const previousStoredName = unit.finishing?.finishingContractFile ?? null;
    await writeUnitDocumentFile(documentType, storedName, buffer);
    await deleteUnitDocumentFile(documentType, previousStoredName);

    await prisma.finishing.upsert({
      where: { unitId },
      create: { unitId, finishingContractFile: storedName },
      update: { finishingContractFile: storedName },
    });
  } else {
    const previousStoredName =
      documentType === "signedContract"
        ? unit.contractWorkflow?.signedContractFile ?? null
        : unit.contractWorkflow?.extensionAnnexFile ?? null;

    await writeUnitDocumentFile(documentType, storedName, buffer);
    await deleteUnitDocumentFile(documentType, previousStoredName);

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

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return { ...actionOk(), filePath: storedName };
}

export async function removeUnitDocument(
  unitId: string,
  documentType: UnitDocumentKind
): Promise<ActionResult> {
  const access = await assertCanUpload(unitId);
  if (!access.ok) return access.result;

  const { unit } = access;

  if (documentType === "finishingContract") {
    const storedName = unit.finishing?.finishingContractFile;
    if (!storedName) return actionFail("No file on record");

    await deleteUnitDocumentFile(documentType, storedName);
    await prisma.finishing.update({
      where: { unitId },
      data: { finishingContractFile: null },
    });
  } else {
    const storedName =
      documentType === "signedContract"
        ? unit.contractWorkflow?.signedContractFile
        : unit.contractWorkflow?.extensionAnnexFile;
    if (!storedName) return actionFail("No file on record");

    await deleteUnitDocumentFile(documentType, storedName);
    await prisma.contractWorkflow.update({
      where: { unitId },
      data:
        documentType === "signedContract"
          ? { signedContractFile: null }
          : { extensionAnnexFile: null },
    });
  }

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return actionOk();
}
