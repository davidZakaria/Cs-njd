"use server";

import { auth } from "@/lib/auth";
import { canUploadClientNationalIdOnUnit } from "@/lib/auth/role-permissions";
import { assertClientLinkedToUnit } from "@/lib/units/assert-unit-client-link";
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

async function loadUnitWithClient(unitId: string, clientId?: string) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { client: true, project: { select: { id: true, name: true } } },
  });
  if (!unit) return null;

  const targetId = clientId?.trim() || unit.clientId;
  if (!targetId) return { unit, client: null };

  if (unit.client?.id === targetId) {
    return { unit, client: unit.client };
  }

  const client = await prisma.client.findUnique({ where: { id: targetId } });
  return { unit, client };
}

export async function uploadNationalId(
  formData: FormData
): Promise<UploadNationalIdResult> {
  const session = await auth();
  if (!session?.user) return uploadFail("Unauthorized");

  const unitId = String(formData.get("unitId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim() || undefined;
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

  const loaded = await loadUnitWithClient(unitId, clientId);
  if (!loaded) return uploadFail("Unit not found");
  const { unit, client } = loaded;
  if (!client) {
    return uploadFail("Save client profile before uploading an ID scan");
  }

  if (!(await assertClientLinkedToUnit(unitId, client.id))) {
    return uploadFail("Client not found");
  }

  if (!canUploadClientNationalIdOnUnit(session.user.role, unit.project)) {
    return uploadFail("Unauthorized");
  }

  const storedName = buildNationalIdStoredFilename(client.id, file.name);
  const previousStoredName = client.nationalIdFile;

  const extractedId =
    file.type.startsWith("image/")
      ? await extractEgyptianNationalId(Buffer.from(await file.arrayBuffer()))
      : null;

  await writeNationalIdFile(storedName, file);
  await deleteNationalIdFile(previousStoredName);

  await prisma.client.update({
    where: { id: client.id },
    data: { nationalIdFile: storedName },
  });

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return { success: true, filePath: storedName, extractedId };
}

export async function removeNationalId(
  unitId: string,
  clientId?: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  const loaded = await loadUnitWithClient(unitId, clientId);
  if (!loaded) return actionFail("Unit not found");
  const { unit, client } = loaded;
  if (!client) return actionFail("Client not found");

  if (!canUploadClientNationalIdOnUnit(session.user.role, unit.project)) {
    return actionFail("Unauthorized");
  }

  const storedName = client.nationalIdFile;
  if (!storedName) return actionFail("No ID scan on file");

  await deleteNationalIdFile(storedName);

  await prisma.client.update({
    where: { id: client.id },
    data: { nationalIdFile: null },
  });

  revalidatePath(`/units/${unitId}`);
  revalidatePath("/units");
  return actionOk();
}
