"use server";

import { revalidatePath } from "next/cache";

import { withAudit } from "@/lib/audit/with-audit";
import { auth } from "@/lib/auth";
import {
  canManageClientNationalIdFile,
  canUploadClientNationalIdOnUnit,
} from "@/lib/auth/role-permissions";
import { assertClientLinkedToUnit } from "@/lib/units/assert-unit-client-link";
import { prisma } from "@/lib/prisma";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { auditContext } from "@/lib/prisma/audit-context";
import { basePrisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/prisma/record-audit-log";
import { extractEgyptianNationalId } from "@/lib/services/ocr";
import {
  buildNationalIdStoredFilename,
  deleteNationalIdFile,
  isAllowedNationalIdMime,
  NATIONAL_ID_MAX_BYTES,
  writeNationalIdFile,
} from "@/lib/uploads/national-id-storage";

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

  const canReplace = canManageClientNationalIdFile(session.user.role);
  const previousStoredName = client.nationalIdFile;
  if (previousStoredName && !canReplace) {
    return uploadFail(
      "A file is already on record. Only management can replace or remove it."
    );
  }

  const storedName = buildNationalIdStoredFilename(client.id, file.name);

  const extractedId =
    file.type.startsWith("image/")
      ? await extractEgyptianNationalId(Buffer.from(await file.arrayBuffer()))
      : null;

  try {
    return await withAudit(async () => {
      await writeNationalIdFile(storedName, file);
      if (canReplace) {
        await deleteNationalIdFile(previousStoredName);
      }

      await prisma.client.update({
        where: { id: client.id },
        data: { nationalIdFile: storedName },
      });

      const ctx = auditContext.getStore();
      if (ctx?.userId) {
        await recordAuditLog(basePrisma, ctx, {
          model: "Client",
          action: "UPDATE",
          recordId: client.id,
          newData: {
            documentType: "nationalIdFile",
            unitId,
            storedName,
            operation: previousStoredName
              ? "national_id_replace"
              : "national_id_upload",
          },
        });
      }

      revalidatePath(`/units/${unitId}`);
      revalidatePath("/units");
      return { success: true, filePath: storedName, extractedId };
    });
  } catch {
    return uploadFail("Upload failed");
  }
}

export async function removeNationalId(
  unitId: string,
  clientId?: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");

  if (!canManageClientNationalIdFile(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const loaded = await loadUnitWithClient(unitId, clientId);
  if (!loaded) return actionFail("Unit not found");
  const { unit, client } = loaded;
  if (!client) return actionFail("Client not found");

  const storedName = client.nationalIdFile;
  if (!storedName) return actionFail("No ID scan on file");

  return withAudit(async () => {
    await deleteNationalIdFile(storedName);

    await prisma.client.update({
      where: { id: client.id },
      data: { nationalIdFile: null },
    });

    const ctx = auditContext.getStore();
    if (ctx?.userId) {
      await recordAuditLog(basePrisma, ctx, {
        model: "Client",
        action: "DELETE",
        recordId: client.id,
        oldData: { documentType: "nationalIdFile", storedName, unitId: unit.id },
        newData: { nationalIdFile: null },
      });
    }

    revalidatePath(`/units/${unitId}`);
    revalidatePath("/units");
    return actionOk();
  });
}
