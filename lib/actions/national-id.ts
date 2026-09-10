"use server";

import { auth } from "@/lib/auth";
import { resolveSignedProtocolAccess } from "@/lib/auth/signed-protocol-access";
import { prisma } from "@/lib/prisma";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { extractEgyptianNationalId } from "@/lib/services/ocr";
import {
  buildNationalIdStoredFilename,
  deleteNationalIdFile,
  isAllowedNationalIdMime,
  NATIONAL_ID_MAX_BYTES,
  writeNationalIdFile,
} from "@/lib/uploads/national-id-storage";
import { revalidatePath } from "next/cache";

export type UploadNationalIdResult =
  | { success: true; filePath: string; extractedId: string | null }
  | { success: false; error: string };

function uploadFail(error: string): Extract<UploadNationalIdResult, { success: false }> {
  return { success: false, error };
}

async function loadUnitWithClient(unitId: string) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    include: { client: true },
  });
}

export async function uploadNationalId(
  formData: FormData
): Promise<UploadNationalIdResult> {
  const session = await auth();
  if (!session?.user) return uploadFail("Unauthorized");

  const unitId = String(formData.get("unitId") ?? "").trim();
  const file = formData.get("file");

  if (!unitId) return uploadFail("Unit is required");
  if (!(file instanceof File)) return uploadFail("No file provided");
  if (file.size === 0) return uploadFail("File is empty");
  if (file.size > NATIONAL_ID_MAX_BYTES) {
    return uploadFail("File exceeds 10 MB limit");
  }
  if (!isAllowedNationalIdMime(file.type)) {
    return uploadFail("Only PDF or image files (JPG, PNG, WebP) are allowed");
  }

  const unit = await loadUnitWithClient(unitId);
  if (!unit) return uploadFail("Unit not found");
  if (!unit.clientId || !unit.client) {
    return uploadFail("Save client profile before uploading an ID scan");
  }

  const { canUpload } = await resolveSignedProtocolAccess(
    session.user,
    unit.agentId
  );
  if (!canUpload) return uploadFail("Unauthorized");

  const storedName = buildNationalIdStoredFilename(unit.clientId, file.name);
  const previousStoredName = unit.client.nationalIdFile;

  const extractedId =
    file.type.startsWith("image/")
      ? await extractEgyptianNationalId(Buffer.from(await file.arrayBuffer()))
      : null;

  await writeNationalIdFile(storedName, file);
  await deleteNationalIdFile(previousStoredName);

  await prisma.client.update({
    where: { id: unit.clientId },
    data: { nationalIdFile: storedName },
  });

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return { success: true, filePath: storedName, extractedId };
}

export async function removeNationalId(unitId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const unit = await loadUnitWithClient(unitId);
  if (!unit) return actionFail("Unit not found");
  if (!unit.clientId || !unit.client) return actionFail("Client not found");

  const { canUpload } = await resolveSignedProtocolAccess(
    session.user,
    unit.agentId
  );
  if (!canUpload) return actionFail("Unauthorized");

  const storedName = unit.client.nationalIdFile;
  if (!storedName) return actionFail("No ID scan on file");

  await deleteNationalIdFile(storedName);

  await prisma.client.update({
    where: { id: unit.clientId },
    data: { nationalIdFile: null },
  });

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return actionOk();
}
