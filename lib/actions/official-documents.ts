"use server";

import { revalidatePath } from "next/cache";

import type { OfficialDocumentType } from "@prisma/client";

import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { auth } from "@/lib/auth";
import { recordOfficialDocumentAudit } from "@/lib/official-documents/audit";
import {
  resolveOfficialDocumentGenerationContext,
} from "@/lib/official-documents/draft-context";
import {
  canEditOfficialDocumentDraftText,
  canEditOfficialDocumentTemplates,
  canGenerateOfficialDocuments,
  canViewOfficialDocuments,
} from "@/lib/official-documents/permissions";
import { renderOfficialDocumentPdf } from "@/lib/official-documents/render-pdf";
import {
  buildGeneratedDocumentStoredFilename,
  writeGeneratedDocumentFile,
} from "@/lib/official-documents/storage";
import { prisma } from "@/lib/prisma";

function parseLocale(value: unknown): "en" | "ar" | null {
  if (value === "en" || value === "ar") return value;
  return null;
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

export async function listUnitOfficialDocumentTextDraftsAction(unitId: string) {
  const session = await auth();
  if (!session?.user) return [];
  if (!canViewOfficialDocuments(session.user.role)) return [];

  return prisma.officialDocumentTextDraft.findMany({
    where: { unitId },
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      _count: { select: { versions: true } },
    },
  });
}

export async function getOfficialDocumentTextDraftAction(draftId: string) {
  const session = await auth();
  if (!session?.user) return null;
  if (!canViewOfficialDocuments(session.user.role)) return null;

  return prisma.officialDocumentTextDraft.findUnique({
    where: { id: draftId },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { editedBy: { select: { id: true, name: true } } },
      },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
    },
  });
}

export async function prepareOfficialDocumentTextDraftAction(input: {
  unitId: string;
  documentType: OfficialDocumentType;
  locale: string;
  unitRequestId?: string | null;
  draftId?: string | null;
}): Promise<ActionResult & { draftId?: string; body?: string; title?: string; locale?: string }> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");
  if (!canEditOfficialDocumentDraftText(session.user.role)) {
    return actionFail("Unauthorized");
  }

  if (input.draftId) {
    const existing = await getOfficialDocumentTextDraftAction(input.draftId);
    if (!existing || existing.unitId !== input.unitId) {
      return actionFail("Draft not found");
    }
    return {
      success: true,
      draftId: existing.id,
      body: existing.currentBody,
      title: existing.title,
      locale: existing.templateLocale,
    };
  }

  const locale = parseLocale(input.locale);
  if (!locale) return actionFail("Invalid locale");

  const ctx = await resolveOfficialDocumentGenerationContext({
    unitId: input.unitId,
    documentType: input.documentType,
    locale,
    unitRequestId: input.unitRequestId,
  });
  if (!ctx.ok) return actionFail(ctx.error);

  const existingDraft = await prisma.officialDocumentTextDraft.findFirst({
    where: {
      unitId: ctx.unit.id,
      documentType: input.documentType,
      templateLocale: locale,
      unitRequestId: ctx.unitRequestId,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existingDraft) {
    return {
      success: true,
      draftId: existingDraft.id,
      body: existingDraft.currentBody,
      title: existingDraft.title,
      locale,
    };
  }

  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.officialDocumentTextDraft.create({
      data: {
        unitId: ctx.unit.id,
        unitRequestId: ctx.unitRequestId,
        documentType: input.documentType,
        templateId: ctx.template.id,
        templateVersion: ctx.template.version,
        templateLocale: locale,
        title: ctx.template.title,
        currentBody: ctx.initialBody,
        createdById: session.user!.id,
        updatedById: session.user!.id,
      },
    });

    await tx.officialDocumentTextDraftVersion.create({
      data: {
        draftId: draft.id,
        body: ctx.initialBody,
        editedById: session.user!.id,
      },
    });

    return draft;
  });

  await recordOfficialDocumentAudit({
    unitId: ctx.unit.id,
    documentType: input.documentType,
    templateVersion: ctx.template.version,
    templateLocale: locale,
    action: "TEXT_DRAFT_CREATED",
    userId: session.user.id,
    details: { draftId: created.id, unitRequestId: ctx.unitRequestId },
  });

  revalidatePath(`/units/${ctx.unit.id}`);
  return {
    success: true,
    draftId: created.id,
    body: created.currentBody,
    title: created.title,
    locale,
  };
}

export async function saveOfficialDocumentTextDraftAction(input: {
  draftId: string;
  body: string;
}): Promise<ActionResult & { versionId?: string }> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");
  if (!canEditOfficialDocumentDraftText(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const draft = await prisma.officialDocumentTextDraft.findUnique({
    where: { id: input.draftId },
  });
  if (!draft) return actionFail("Draft not found");

  const body = input.body.trimEnd();
  if (!body.trim()) return actionFail("Draft text is required");

  const version = await prisma.$transaction(async (tx) => {
    await tx.officialDocumentTextDraft.update({
      where: { id: draft.id },
      data: {
        currentBody: body,
        updatedById: session.user!.id,
      },
    });

    return tx.officialDocumentTextDraftVersion.create({
      data: {
        draftId: draft.id,
        body,
        editedById: session.user!.id,
      },
    });
  });

  await recordOfficialDocumentAudit({
    unitId: draft.unitId,
    documentType: draft.documentType,
    templateVersion: draft.templateVersion,
    templateLocale: draft.templateLocale,
    action: "TEXT_DRAFT_SAVED",
    userId: session.user.id,
    details: { draftId: draft.id, versionId: version.id },
  });

  revalidatePath(`/units/${draft.unitId}`);
  return { success: true, versionId: version.id };
}

export async function generateOfficialDocumentAction(input: {
  unitId: string;
  textDraftId: string;
}): Promise<ActionResult & { documentId?: string }> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");
  if (!canGenerateOfficialDocuments(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const draft = await prisma.officialDocumentTextDraft.findFirst({
    where: { id: input.textDraftId, unitId: input.unitId },
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!draft) return actionFail("Text draft not found");

  const latestVersion = draft.versions[0];
  if (!latestVersion) return actionFail("Draft has no saved versions");

  const ctx = await resolveOfficialDocumentGenerationContext({
    unitId: draft.unitId,
    documentType: draft.documentType,
    locale: draft.templateLocale as "en" | "ar",
    unitRequestId: draft.unitRequestId,
  });
  if (!ctx.ok) return actionFail(ctx.error);

  const pdfBytes = await renderOfficialDocumentPdf({
    title: draft.title,
    bodyTemplate: draft.currentBody,
    fields: {},
    locale: draft.templateLocale,
    watermarkDraft: true,
    bodyIsFinal: true,
  });

  const storedName = buildGeneratedDocumentStoredFilename(
    draft.documentType,
    draft.templateLocale
  );
  await writeGeneratedDocumentFile(ctx.unit.id, storedName, pdfBytes);

  const displayName = `${draft.title} — ${ctx.unit.unitCode}`;

  const created = await prisma.unitGeneratedDocument.create({
    data: {
      unitId: ctx.unit.id,
      unitRequestId: draft.unitRequestId,
      documentType: draft.documentType,
      templateId: draft.templateId,
      templateVersion: draft.templateVersion,
      templateLocale: draft.templateLocale,
      storedName,
      displayName,
      sizeBytes: pdfBytes.length,
      textDraftId: draft.id,
      textDraftVersionId: latestVersion.id,
      generatedById: session.user.id,
    },
  });

  await recordOfficialDocumentAudit({
    unitId: ctx.unit.id,
    documentType: draft.documentType,
    templateVersion: draft.templateVersion,
    templateLocale: draft.templateLocale,
    action: "GENERATE_DRAFT",
    userId: session.user.id,
    details: {
      documentId: created.id,
      textDraftId: draft.id,
      textDraftVersionId: latestVersion.id,
      unitRequestId: draft.unitRequestId,
      storedName,
    },
  });

  revalidatePath(`/units/${ctx.unit.id}`);
  return { success: true, documentId: created.id };
}

export async function generateOfficialDocumentFormAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const textDraftId = String(formData.get("textDraftId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");

  if (!textDraftId || !unitId) {
    return actionFail("Invalid form data");
  }

  const result = await generateOfficialDocumentAction({
    unitId,
    textDraftId,
  });
  return result.success
    ? actionOk()
    : actionFail(result.error ?? "Generation failed");
}
