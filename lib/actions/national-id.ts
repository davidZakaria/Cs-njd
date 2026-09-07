"use server";

import { auth } from "@/lib/auth";
import { resolveSignedProtocolAccess } from "@/lib/auth/signed-protocol-access";
import { prisma } from "@/lib/prisma";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import {
  buildNationalIdStoredFilename,
  deleteNationalIdFile,
  isAllowedNationalIdMime,
  NATIONAL_ID_MAX_BYTES,
  writeNationalIdFile,
} from "@/lib/uploads/national-id-storage";
import { revalidatePath } from "next/cache";

async function loadUnitWithClient(unitId: string) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    include: { client: true },
  });
}

export async function uploadNationalId(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const unitId = String(formData.get("unitId") ?? "").trim();
  const file = formData.get("file");

  if (!unitId) return actionFail("Unit is required");
  if (!(file instanceof File)) return actionFail("No file provided");
  if (file.size === 0) return actionFail("File is empty");
  if (file.size > NATIONAL_ID_MAX_BYTES) {
    return actionFail("File exceeds 10 MB limit");
  }
  if (!isAllowedNationalIdMime(file.type)) {
    return actionFail("Only PDF or image files (JPG, PNG, WebP) are allowed");
  }

  const unit = await loadUnitWithClient(unitId);
  if (!unit) return actionFail("Unit not found");
  if (!unit.clientId || !unit.client) {
    return actionFail("Save client profile before uploading an ID scan");
  }

  const { canUpload } = await resolveSignedProtocolAccess(
    session.user,
    unit.agentId
  );
  if (!canUpload) return actionFail("Unauthorized");

  const buffer = Buffer.from(await file.arrayBuffer());
  const storedName = buildNationalIdStoredFilename(unit.clientId, file.name);
  const previousStoredName = unit.client.nationalIdFile;

  await writeNationalIdFile(storedName, buffer);
  await deleteNationalIdFile(previousStoredName);

  await prisma.client.update({
    where: { id: unit.clientId },
    data: { nationalIdFile: storedName },
  });

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return actionOk();
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
