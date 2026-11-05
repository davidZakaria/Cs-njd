"use server";

import { revalidatePath } from "next/cache";

import type { OfficialDocumentType } from "@prisma/client";

import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";
import { auth } from "@/lib/auth";
import { recordOfficialDocumentAudit } from "@/lib/official-documents/audit";
import {
  assertLinkedUnitRequestAllowsOfficialDocumentMutation,
  assertOfficialTextDraftMutable,
} from "@/lib/official-documents/document-mutation-guards";
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
  listMissingFieldsInBody,
  officialHandoverMissingFieldLabel,
} from "@/lib/official-documents/handover/missing-fields-ui";
import { buildOfficialHandoverFieldValues } from "@/lib/official-documents/handover/field-values";
import {
  handoverDraftIsLegacyGenericPlaceholder,
  handoverDraftNeedsOfficialMasterSync,
  usesOfficialHandoverLegalMasters,
} from "@/lib/official-documents/handover/document-locale";
import { renderOfficialHandoverRecordPdf } from "@/lib/official-documents/handover/render-pdf";
import { getCompanyProfileSettings } from "@/lib/system/settings-store";
import type { HandoverTemplateKey } from "@/lib/print/handover-templates/types";
import {
  buildGeneratedDocumentStoredFilename,
  writeGeneratedDocumentFile,
} from "@/lib/official-documents/storage";
import { prisma } from "@/lib/prisma";

function parseHandoverTemplateKey(value: unknown): HandoverTemplateKey | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const allowed: HandoverTemplateKey[] = [
    "green-avenue",
    "green-avenue-no-insurance",
    "green-avenue-dual",
    "green-avenue-dual-no-insurance",
    "jura",
    "jura-dual",
  ];
  return allowed.includes(value as HandoverTemplateKey)
    ? (value as HandoverTemplateKey)
    : null;
}

function parseLocale(value: unknown): "en" | "ar" | null {
  if (value === "en" || value === "ar") return value;
  return null;
}

function formatHandoverMissingFieldsMessage(
  keys: string[],
  locale: string
): string {
  const labels = keys.map((key) => officialHandoverMissingFieldLabel(key, locale));
  return locale === "ar"
    ? `لا يمكن إنشاء PDF — أكمل الحقول التالية: ${labels.join("؛ ")}`
    : `Cannot generate PDF — complete the following fields: ${labels.join("; ")}`;
}

async function syncOfficialHandoverTextDraftIfNeeded(input: {
  draft: {
    id: string;
    unitId: string;
    documentType: OfficialDocumentType;
    templateLocale: string;
    handoverTemplateKey: string | null;
    currentBody: string;
    unitRequestId: string | null;
    templateId: string;
    templateVersion: number;
  };
  userId: string;
  handoverKeyOverride?: HandoverTemplateKey | null;
}): Promise<
  | {
      synced: true;
      body: string;
      title: string;
      handoverTemplateKey: HandoverTemplateKey;
      templateLocale: "ar";
      proposedOfficialBody?: string;
    }
  | { synced: false }
> {
  const unit = await prisma.unit.findFirst({
    where: { id: input.draft.unitId },
    select: { project: { select: { name: true, unitCycleEnabled: true } } },
  });
  if (!unit) return { synced: false };

  if (
    !handoverDraftNeedsOfficialMasterSync(
      input.draft,
      unit.project.name
    )
  ) {
    return { synced: false };
  }

  const ctx = await resolveOfficialDocumentGenerationContext({
    unitId: input.draft.unitId,
    documentType: input.draft.documentType,
    locale: "en",
    unitRequestId: input.draft.unitRequestId,
    handoverTemplateKey:
      input.handoverKeyOverride ??
      parseHandoverTemplateKey(input.draft.handoverTemplateKey),
  });
  if (!ctx.ok || !ctx.handoverTemplateKey) {
    return { synced: false };
  }

  const preservedBody = input.draft.currentBody;
  const proposedOfficialBody = handoverDraftIsLegacyGenericPlaceholder(
    preservedBody
  )
    ? ctx.initialBody
    : undefined;

  await prisma.officialDocumentTextDraft.update({
    where: { id: input.draft.id },
    data: {
      templateId: ctx.template.id,
      templateVersion: ctx.template.version,
      templateLocale: "ar",
      title: ctx.template.title,
      handoverTemplateKey: ctx.handoverTemplateKey,
      updatedById: input.userId,
      // Intentionally does NOT set currentBody — legacy/user text stays until explicit save or “Load proposed”.
    },
  });

  return {
    synced: true,
    body: preservedBody,
    title: ctx.template.title,
    handoverTemplateKey: ctx.handoverTemplateKey,
    templateLocale: "ar",
    proposedOfficialBody,
  };
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
  handoverTemplateKey?: string | null;
}): Promise<
  ActionResult & {
    draftId?: string;
    body?: string;
    title?: string;
    locale?: string;
    handoverTemplateKey?: string | null;
    handoverMissingFieldKeys?: string[];
    proposedOfficialBody?: string;
  }
> {
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
    const sync = await syncOfficialHandoverTextDraftIfNeeded({
      draft: existing,
      userId: session.user.id,
      handoverKeyOverride: parseHandoverTemplateKey(input.handoverTemplateKey),
    });
    if (sync.synced) {
      revalidatePath(`/units/${input.unitId}`);
      return {
        success: true,
        draftId: existing.id,
        body: sync.body,
        title: sync.title,
        locale: sync.templateLocale,
        handoverTemplateKey: sync.handoverTemplateKey,
        proposedOfficialBody: sync.proposedOfficialBody,
      };
    }
    return {
      success: true,
      draftId: existing.id,
      body: existing.currentBody,
      title: existing.title,
      locale: existing.templateLocale,
      handoverTemplateKey: existing.handoverTemplateKey,
    };
  }

  const locale = parseLocale(input.locale);
  if (!locale) return actionFail("Invalid locale");

  const handoverKeyOverride = parseHandoverTemplateKey(input.handoverTemplateKey);

  const ctx = await resolveOfficialDocumentGenerationContext({
    unitId: input.unitId,
    documentType: input.documentType,
    locale,
    unitRequestId: input.unitRequestId,
    handoverTemplateKey: handoverKeyOverride,
  });
  if (!ctx.ok) return actionFail(ctx.error);

  const effectiveLocale = ctx.template.locale as "en" | "ar";

  let existingDraft = await prisma.officialDocumentTextDraft.findFirst({
    where: {
      unitId: ctx.unit.id,
      documentType: input.documentType,
      templateLocale: effectiveLocale,
      unitRequestId: ctx.unitRequestId,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!existingDraft && effectiveLocale === "ar") {
    existingDraft = await prisma.officialDocumentTextDraft.findFirst({
      where: {
        unitId: ctx.unit.id,
        documentType: input.documentType,
        templateLocale: "en",
        unitRequestId: ctx.unitRequestId,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (existingDraft) {
    const sync = await syncOfficialHandoverTextDraftIfNeeded({
      draft: existingDraft,
      userId: session.user.id,
      handoverKeyOverride: handoverKeyOverride,
    });
    if (sync.synced) {
      revalidatePath(`/units/${ctx.unit.id}`);
      return {
        success: true,
        draftId: existingDraft.id,
        body: sync.body,
        title: sync.title,
        locale: sync.templateLocale,
        handoverTemplateKey: sync.handoverTemplateKey,
        handoverMissingFieldKeys: ctx.handoverMissingFieldKeys,
        proposedOfficialBody: sync.proposedOfficialBody,
      };
    }
    return {
      success: true,
      draftId: existingDraft.id,
      body: existingDraft.currentBody,
      title: existingDraft.title,
      locale: existingDraft.templateLocale,
      handoverTemplateKey: existingDraft.handoverTemplateKey,
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
        templateLocale: effectiveLocale,
        title: ctx.template.title,
        currentBody: ctx.initialBody,
        handoverTemplateKey: ctx.handoverTemplateKey,
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
    templateLocale: effectiveLocale,
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
    locale: effectiveLocale,
    handoverTemplateKey: created.handoverTemplateKey,
    handoverMissingFieldKeys: ctx.handoverMissingFieldKeys,
  };
}

export async function applyOfficialHandoverVariantAction(input: {
  draftId: string;
  handoverTemplateKey: string;
}): Promise<
  ActionResult & {
    body?: string;
    title?: string;
    handoverMissingFieldKeys?: string[];
  }
> {
  const session = await auth();
  if (!session?.user) return actionFail("Unauthorized");
  if (!canEditOfficialDocumentDraftText(session.user.role)) {
    return actionFail("Unauthorized");
  }

  const key = parseHandoverTemplateKey(input.handoverTemplateKey);
  if (!key) return actionFail("Invalid handover variant");

  const draft = await prisma.officialDocumentTextDraft.findUnique({
    where: { id: input.draftId },
  });
  if (!draft) return actionFail("Draft not found");
  if (draft.documentType !== "HANDOVER_RECORD") {
    return actionFail("Variant override applies to handover records only");
  }

  const ctx = await resolveOfficialDocumentGenerationContext({
    unitId: draft.unitId,
    documentType: draft.documentType,
    locale: draft.templateLocale as "en" | "ar",
    unitRequestId: draft.unitRequestId,
    handoverTemplateKey: key,
  });
  if (!ctx.ok) return actionFail(ctx.error);

  await prisma.$transaction(async (tx) => {
    await tx.officialDocumentTextDraft.update({
      where: { id: draft.id },
      data: {
        handoverTemplateKey: key,
        title: ctx.template.title,
        currentBody: ctx.initialBody,
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
  });

  revalidatePath(`/units/${draft.unitId}`);
  return {
    success: true,
    body: ctx.initialBody,
    title: ctx.template.title,
    handoverMissingFieldKeys: ctx.handoverMissingFieldKeys,
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

  const signedGuard = await assertOfficialTextDraftMutable(draft.id);
  if (signedGuard && !signedGuard.success) return signedGuard;

  const requestGuard = await assertLinkedUnitRequestAllowsOfficialDocumentMutation({
    unitId: draft.unitId,
    documentType: draft.documentType,
    unitRequestId: draft.unitRequestId,
  });
  if (requestGuard && !requestGuard.success) return requestGuard;

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
  });
  if (!draft) return actionFail("Text draft not found");

  const signedGuard = await assertOfficialTextDraftMutable(draft.id);
  if (signedGuard && !signedGuard.success) return signedGuard;

  const requestGuard = await assertLinkedUnitRequestAllowsOfficialDocumentMutation({
    unitId: draft.unitId,
    documentType: draft.documentType,
    unitRequestId: draft.unitRequestId,
  });
  if (requestGuard && !requestGuard.success) return requestGuard;

  const sync = await syncOfficialHandoverTextDraftIfNeeded({
    draft,
    userId: session.user.id,
    handoverKeyOverride: parseHandoverTemplateKey(draft.handoverTemplateKey),
  });
  const workingDraft = sync.synced
    ? {
        ...draft,
        currentBody: sync.body,
        title: sync.title,
        templateLocale: sync.templateLocale,
        handoverTemplateKey: sync.handoverTemplateKey,
      }
    : draft;

  const latestVersion = await prisma.officialDocumentTextDraftVersion.findFirst({
    where: { draftId: workingDraft.id },
    orderBy: { createdAt: "desc" },
  });
  if (!latestVersion) return actionFail("Draft has no saved versions");

  const savedBody = latestVersion.body;

  const ctx = await resolveOfficialDocumentGenerationContext({
    unitId: workingDraft.unitId,
    documentType: workingDraft.documentType,
    locale: workingDraft.templateLocale as "en" | "ar",
    unitRequestId: workingDraft.unitRequestId,
    handoverTemplateKey: parseHandoverTemplateKey(workingDraft.handoverTemplateKey),
  });
  if (!ctx.ok) return actionFail(ctx.error);

  const handoverTemplateKey =
    parseHandoverTemplateKey(workingDraft.handoverTemplateKey) ??
    ctx.handoverTemplateKey;

  const usesOfficialHandoverPdf =
    usesOfficialHandoverLegalMasters({
      documentType: workingDraft.documentType,
      projectName: ctx.mergeUnit.project.name,
    }) && Boolean(handoverTemplateKey);

  if (
    usesOfficialHandoverLegalMasters({
      documentType: workingDraft.documentType,
      projectName: ctx.mergeUnit.project.name,
    }) &&
    !handoverTemplateKey
  ) {
    return actionFail("Could not resolve handover template variant for this unit");
  }

  const missingInBody = listMissingFieldsInBody(savedBody);
  if (missingInBody.length > 0) {
    return actionFail(
      formatHandoverMissingFieldsMessage(
        missingInBody,
        usesOfficialHandoverPdf ? "ar" : workingDraft.templateLocale
      )
    );
  }

  if (
    usesOfficialHandoverPdf &&
    handoverDraftIsLegacyGenericPlaceholder(savedBody)
  ) {
    return actionFail(
      "Save the official Arabic handover text before generating (legacy English placeholder still in editor)."
    );
  }

  const companyProfile = await getCompanyProfileSettings();
  const handoverFields = usesOfficialHandoverPdf
    ? buildOfficialHandoverFieldValues(ctx.mergeUnit, "ar").handoverFields
    : null;

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = usesOfficialHandoverPdf
      ? await renderOfficialHandoverRecordPdf({
          templateKey: handoverTemplateKey as HandoverTemplateKey,
          fields: handoverFields!,
          companyAddress: companyProfile.address,
          watermarkDraft: true,
          draftBody: savedBody,
        })
      : await renderOfficialDocumentPdf({
          title: workingDraft.title,
          bodyTemplate: savedBody,
          fields: {},
          locale: workingDraft.templateLocale,
          watermarkDraft: true,
          bodyIsFinal: true,
        });
  } catch (error) {
    console.error("Official document PDF render failed", error);
    return actionFail(
      usesOfficialHandoverPdf
        ? "Handover PDF engine failed (Chromium). Contact support — do not use the generic template."
        : "PDF generation failed"
    );
  }

  const storedName = buildGeneratedDocumentStoredFilename(
    workingDraft.documentType,
    usesOfficialHandoverPdf ? "ar" : workingDraft.templateLocale
  );
  await writeGeneratedDocumentFile(ctx.unit.id, storedName, pdfBytes);

  const displayName = `${workingDraft.title} — ${ctx.unit.unitCode}`;

  const created = await prisma.unitGeneratedDocument.create({
    data: {
      unitId: ctx.unit.id,
      unitRequestId: workingDraft.unitRequestId,
      documentType: workingDraft.documentType,
      templateId: workingDraft.templateId,
      templateVersion: workingDraft.templateVersion,
      templateLocale: usesOfficialHandoverPdf
        ? "ar"
        : workingDraft.templateLocale,
      storedName,
      displayName,
      sizeBytes: pdfBytes.length,
      textDraftId: workingDraft.id,
      textDraftVersionId: latestVersion.id,
      generatedById: session.user.id,
    },
  });

  await recordOfficialDocumentAudit({
    unitId: ctx.unit.id,
    documentType: workingDraft.documentType,
    templateVersion: workingDraft.templateVersion,
    templateLocale: usesOfficialHandoverPdf ? "ar" : workingDraft.templateLocale,
    action: "GENERATE_DRAFT",
    userId: session.user.id,
    details: {
      documentId: created.id,
      textDraftId: workingDraft.id,
      textDraftVersionId: latestVersion.id,
      unitRequestId: workingDraft.unitRequestId,
      storedName,
      handoverTemplateKey: handoverTemplateKey ?? undefined,
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
