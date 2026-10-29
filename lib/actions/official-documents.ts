"use server";

import { revalidatePath } from "next/cache";

import type { OfficialDocumentType } from "@prisma/client";

import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { auth } from "@/lib/auth";
import { recordOfficialDocumentAudit } from "@/lib/official-documents/audit";
import {
  buildOfficialDocumentMergeFields,
  type UnitMergeInput,
} from "@/lib/official-documents/merge-fields";
import {
  canEditOfficialDocumentTemplates,
  canGenerateOfficialDocuments,
  canViewOfficialDocuments,
  isOfficialDocumentsFeatureEnabledForProject,
} from "@/lib/official-documents/permissions";
import { renderOfficialDocumentPdf } from "@/lib/official-documents/render-pdf";
import {
  documentTypeMatchesRequest,
  requiredRequestTypeForDocument,
} from "@/lib/official-documents/request-binding";
import {
  buildGeneratedDocumentStoredFilename,
  writeGeneratedDocumentFile,
} from "@/lib/official-documents/storage";
import { prisma } from "@/lib/prisma";
import { activeUnitWhere } from "@/lib/prisma/soft-delete";

const UNIT_INCLUDE = {
  project: true,
  client: {
    include: { phones: true, addresses: true },
  },
  unitClients: {
    orderBy: { position: "asc" as const },
    include: {
      client: { include: { phones: true, addresses: true } },
    },
  },
  contractWorkflow: true,
  finishing: true,
} as const;

function parseDocumentType(value: unknown): OfficialDocumentType | null {
  if (typeof value !== "string") return null;
  const types: OfficialDocumentType[] = [
    "GRACE_PERIOD_ANNEX",
    "CONTRACT_AMENDMENT",
    "HANDOVER_RECORD",
    "FINISHING_CONTRACT_SUMMARY",
    "UNIT_SWAP_ADDENDUM",
  ];
  return types.includes(value as OfficialDocumentType)
    ? (value as OfficialDocumentType)
    : null;
}

function parseLocale(value: unknown): "en" | "ar" | null {
  if (value === "en" || value === "ar") return value;
  return null;
}

async function loadUnitForMerge(unitId: string) {
  return prisma.unit.findFirst({
    where: activeUnitWhere({ id: unitId }),
    include: UNIT_INCLUDE,
  });
}

export async function listActiveOfficialDocumentTemplatesAction() {
  const session = await auth();
  if (!session?.user) return [];
  if (!canViewOfficialDocuments(session.user.role)) return [];

  return prisma.officialDocumentTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ documentType: "asc" }, { locale: "asc" }],
  });
}

export async function listOfficialDocumentTemplateVersionsAction(
  documentType: OfficialDocumentType,
  locale: string
) {
  const session = await auth();
  if (!session?.user) return [];
  if (!canEditOfficialDocumentTemplates(session.user.role)) return [];

  return prisma.officialDocumentTemplate.findMany({
    where: { documentType, locale },
    orderBy: { version: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function saveOfficialDocumentTemplateVersionAction(input: {
  documentType: OfficialDocumentType;
  locale: string;
  title: string;
  body: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");
  if (!canEditOfficialDocumentTemplates(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return actionFail("Title and body are required");
  if (input.locale !== "en" && input.locale !== "ar") {
    return actionFail("Invalid locale");
  }

  const latest = await prisma.officialDocumentTemplate.findFirst({
    where: {
      documentType: input.documentType,
      locale: input.locale,
    },
    orderBy: { version: "desc" },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  await prisma.$transaction(async (tx) => {
    await tx.officialDocumentTemplate.updateMany({
      where: {
        documentType: input.documentType,
        locale: input.locale,
        isActive: true,
      },
      data: { isActive: false },
    });

    await tx.officialDocumentTemplate.create({
      data: {
        documentType: input.documentType,
        locale: input.locale,
        version: nextVersion,
        title,
        body,
        isActive: true,
        createdById: session.user!.id,
      },
    });
  });

  await recordOfficialDocumentAudit({
    action: "TEMPLATE_VERSION_CREATE",
    documentType: input.documentType,
    templateVersion: nextVersion,
    templateLocale: input.locale,
    userId: session.user.id,
    details: { title },
  });

  revalidatePath("/executive/document-templates");
  return actionOk();
}

export async function listUnitGeneratedDocumentsAction(unitId: string) {
  const session = await auth();
  if (!session?.user) return [];
  if (!canViewOfficialDocuments(session.user.role)) return [];

  return prisma.unitGeneratedDocument.findMany({
    where: { unitId },
    orderBy: { generatedAt: "desc" },
    include: {
      generatedBy: { select: { id: true, name: true } },
      unitRequest: { select: { id: true, type: true, status: true } },
    },
  });
}

export async function generateOfficialDocumentAction(input: {
  unitId: string;
  documentType: OfficialDocumentType;
  locale: string;
  unitRequestId?: string | null;
}): Promise<ActionResult & { documentId?: string }> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");
  if (!canGenerateOfficialDocuments(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const unit = await loadUnitForMerge(input.unitId);
  if (!unit) return actionFail("Unit not found");

  if (
    !isOfficialDocumentsFeatureEnabledForProject({
      unitCycleEnabled: unit.project.unitCycleEnabled,
    })
  ) {
    return actionFail("Official document generation is not enabled for this project");
  }

  const locale = parseLocale(input.locale);
  if (!locale) return actionFail("Invalid locale");

  const template = await prisma.officialDocumentTemplate.findFirst({
    where: {
      documentType: input.documentType,
      locale,
      isActive: true,
    },
  });
  if (!template) {
    return actionFail("No active template for this document and language");
  }

  let requestDescription: string | null = null;
  const unitRequestId: string | null = input.unitRequestId ?? null;

  const requiredType = requiredRequestTypeForDocument(input.documentType);
  if (requiredType) {
    if (!unitRequestId) {
      return actionFail("An approved request is required for this document type");
    }
    const request = await prisma.unitRequest.findFirst({
      where: {
        id: unitRequestId,
        unitId: unit.id,
        type: requiredType,
        status: "APPROVED",
      },
    });
    if (!request) {
      return actionFail("Linked request must be approved before generation");
    }
    requestDescription = request.description;
  } else if (unitRequestId) {
    const request = await prisma.unitRequest.findFirst({
      where: { id: unitRequestId, unitId: unit.id },
    });
    if (!request) return actionFail("Request not found for this unit");
    if (!documentTypeMatchesRequest(input.documentType, request.type)) {
      return actionFail("Request type does not match this document");
    }
    requestDescription = request.description;
  }

  const mergeUnit = mapUnitMergeInput(unit);
  const fields = buildOfficialDocumentMergeFields(mergeUnit, locale, {
    requestDescription,
  });

  const pdfBytes = await renderOfficialDocumentPdf({
    title: template.title,
    bodyTemplate: template.body,
    fields,
    locale,
    watermarkDraft: true,
  });

  const storedName = buildGeneratedDocumentStoredFilename(
    input.documentType,
    locale
  );
  await writeGeneratedDocumentFile(unit.id, storedName, pdfBytes);

  const displayName = `${template.title} — ${unit.unitCode}`;

  const created = await prisma.unitGeneratedDocument.create({
    data: {
      unitId: unit.id,
      unitRequestId,
      documentType: input.documentType,
      templateId: template.id,
      templateVersion: template.version,
      templateLocale: locale,
      storedName,
      displayName,
      sizeBytes: pdfBytes.length,
      generatedById: session.user.id,
    },
  });

  await recordOfficialDocumentAudit({
    unitId: unit.id,
    documentType: input.documentType,
    templateVersion: template.version,
    templateLocale: locale,
    action: "GENERATE_DRAFT",
    userId: session.user.id,
    details: {
      documentId: created.id,
      unitRequestId,
      storedName,
    },
  });

  revalidatePath(`/units/${unit.id}`);
  return { success: true, documentId: created.id };
}

function mapUnitMergeInput(
  unit: NonNullable<Awaited<ReturnType<typeof loadUnitForMerge>>>
): UnitMergeInput {
  return {
    unitCode: unit.unitCode,
    area: unit.area,
    gracePeriod: unit.gracePeriod,
    contractPricePerMeter: unit.contractPricePerMeter,
    swapOutgoingUnitCode: unit.swapOutgoingUnitCode,
    swapOutgoingProjectName: unit.swapOutgoingProjectName,
    swappedFromUnitCode: unit.swappedFromUnitCode,
    swappedFromProjectName: unit.swappedFromProjectName,
    project: unit.project,
    client: unit.client,
    unitClients: unit.unitClients.map((link) => ({
      role: link.role,
      client: link.client,
    })),
    contractWorkflow: unit.contractWorkflow,
    finishing: unit.finishing,
  };
}

export async function generateOfficialDocumentFormAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const documentType = parseDocumentType(formData.get("documentType"));
  const unitId = String(formData.get("unitId") ?? "");
  const locale = parseLocale(formData.get("locale"));
  const unitRequestIdRaw = formData.get("unitRequestId");
  const unitRequestId =
    typeof unitRequestIdRaw === "string" && unitRequestIdRaw
      ? unitRequestIdRaw
      : null;

  if (!documentType || !unitId || !locale) {
    return actionFail("Invalid form data");
  }

  const result = await generateOfficialDocumentAction({
    unitId,
    documentType,
    locale,
    unitRequestId,
  });
  return result.success
    ? actionOk()
    : actionFail(result.error ?? "Generation failed");
}
