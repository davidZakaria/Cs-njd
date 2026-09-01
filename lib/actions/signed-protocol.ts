"use server";

import { auth } from "@/lib/auth";
import { resolveSignedProtocolAccess } from "@/lib/auth/signed-protocol-access";
import { prisma } from "@/lib/prisma";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import {
  buildStoredFilename,
  deleteSignedProtocolFile,
  isAllowedSignedProtocolMime,
  SIGNED_PROTOCOL_MAX_BYTES,
  writeSignedProtocolFile,
} from "@/lib/uploads/signed-protocol-storage";
import { revalidatePath } from "next/cache";

async function loadUnitForUpload(unitId: string) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    include: { contractWorkflow: true },
  });
}

export async function uploadSignedProtocol(
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const unitId = String(formData.get("unitId") ?? "").trim();
  const file = formData.get("file");

  if (!unitId) return actionFail("Unit is required");
  if (!(file instanceof File)) return actionFail("No file provided");
  if (file.size === 0) return actionFail("File is empty");
  if (file.size > SIGNED_PROTOCOL_MAX_BYTES) {
    return actionFail("File exceeds 15 MB limit");
  }
  if (!isAllowedSignedProtocolMime(file.type)) {
    return actionFail("Only PDF or image files (JPG, PNG, WebP) are allowed");
  }

  const unit = await loadUnitForUpload(unitId);
  if (!unit) return actionFail("Unit not found");

  const { canUpload } = await resolveSignedProtocolAccess(
    session.user,
    unit.agentId
  );
  if (!canUpload) return actionFail("Unauthorized");

  const hasResolvedTicket = await prisma.ticket.count({
    where: { unitId, status: "RESOLVED", deletedAt: null },
  });
  if (hasResolvedTicket === 0) {
    return actionFail("Upload is available after at least one case is resolved");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storedName = buildStoredFilename(file.name);
  const previousStoredName = unit.contractWorkflow?.signedProtocolStoredName;

  await writeSignedProtocolFile(unitId, storedName, buffer);
  await deleteSignedProtocolFile(unitId, previousStoredName);

  await prisma.contractWorkflow.upsert({
    where: { unitId },
    update: {
      signedProtocolStoredName: storedName,
      signedProtocolOriginalName: file.name,
      signedProtocolMimeType: file.type,
      signedProtocolSizeBytes: file.size,
      signedProtocolUploadedAt: new Date(),
      signedProtocolUploadedById: session.user.id,
      hasSignedProtocol: true,
      papersReceived: true,
    },
    create: {
      unitId,
      signedProtocolStoredName: storedName,
      signedProtocolOriginalName: file.name,
      signedProtocolMimeType: file.type,
      signedProtocolSizeBytes: file.size,
      signedProtocolUploadedAt: new Date(),
      signedProtocolUploadedById: session.user.id,
      hasSignedProtocol: true,
      papersReceived: true,
    },
  });

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  revalidatePath("/cases");
  revalidatePath("/dashboard");
  return actionOk();
}

export async function removeSignedProtocol(unitId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const unit = await loadUnitForUpload(unitId);
  if (!unit) return actionFail("Unit not found");

  const { canUpload } = await resolveSignedProtocolAccess(
    session.user,
    unit.agentId
  );
  if (!canUpload) return actionFail("Unauthorized");

  const storedName = unit.contractWorkflow?.signedProtocolStoredName;
  if (!storedName) return actionFail("No signed document on file");

  await deleteSignedProtocolFile(unitId, storedName);

  await prisma.contractWorkflow.update({
    where: { unitId },
    data: {
      signedProtocolStoredName: null,
      signedProtocolOriginalName: null,
      signedProtocolMimeType: null,
      signedProtocolSizeBytes: null,
      signedProtocolUploadedAt: null,
      signedProtocolUploadedById: null,
      hasSignedProtocol: false,
    },
  });

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  revalidatePath("/cases");
  return actionOk();
}
