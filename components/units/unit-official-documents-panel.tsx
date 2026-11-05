"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import type { OfficialDocumentType, UnitRequestType } from "@prisma/client";

import {
  generateOfficialDocumentAction,
  applyOfficialHandoverVariantAction,
  getOfficialDocumentTextDraftAction,
  prepareOfficialDocumentTextDraftAction,
  saveOfficialDocumentTextDraftAction,
} from "@/lib/actions/official-documents";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { OFFICIAL_DOCUMENT_TYPES } from "@/lib/official-documents/types";
import {
  buildPrefilledCreateUnitRequestHref,
  canEditOfficialDocumentDraftNow,
  filterApprovedRequestsForDocumentType,
  formatApprovedUnitRequestOptionLabel,
  resolveAutoLinkedUnitRequestId,
} from "@/lib/official-documents/approved-request-option";
import { requiredRequestTypeForDocument } from "@/lib/official-documents/request-binding";
import { cn } from "@/lib/utils";
import { handoverUsesOfficialMasters } from "@/lib/official-documents/handover/constants";
import {
  listOfficialHandoverTemplateKeysForProject,
  officialHandoverVariantLabelKey,
} from "@/lib/official-documents/handover/variant-options";
import {
  listMissingFieldsInBody,
  officialHandoverMissingFieldLabel,
} from "@/lib/official-documents/handover/missing-fields-ui";
import type { HandoverTemplateKey } from "@/lib/print/handover-templates/types";

type GeneratedRow = {
  id: string;
  documentType: OfficialDocumentType;
  displayName: string;
  templateVersion: number;
  templateLocale: string;
  generatedAt: Date;
  signedCopyOnFileAt: Date | null;
  generatedBy: { name: string };
};

type TextDraftRow = {
  id: string;
  documentType: OfficialDocumentType;
  templateLocale: string;
  title: string;
  updatedAt: Date;
  versionCount: number;
  updatedByName: string;
};

export type UnitRequestOption = {
  id: string;
  type: UnitRequestType;
  status: string;
  submittedAt: Date | null;
  updatedAt: Date;
  description: string | null;
};

export function UnitOfficialDocumentsPanel({
  unitId,
  projectName,
  canEditDraftText,
  canViewDraftText,
  canGeneratePdf,
  canCreateUnitRequest,
  generatedDocuments,
  textDrafts,
  approvedRequests,
}: {
  unitId: string;
  projectName: string;
  canEditDraftText: boolean;
  canViewDraftText: boolean;
  canGeneratePdf: boolean;
  canCreateUnitRequest: boolean;
  generatedDocuments: GeneratedRow[];
  textDrafts: TextDraftRow[];
  approvedRequests: UnitRequestOption[];
}) {
  const t = useTranslations("officialDocuments");
  const tEnums = useTranslations("enums");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [documentType, setDocumentType] = useState<OfficialDocumentType>(
    "GRACE_PERIOD_ANNEX"
  );
  const [unitRequestId, setUnitRequestId] = useState<string>("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [editorLocale, setEditorLocale] = useState<string>(locale);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorBody, setEditorBody] = useState("");
  const [handoverTemplateKey, setHandoverTemplateKey] = useState<
    HandoverTemplateKey | null
  >(null);
  const [versionHistory, setVersionHistory] = useState<
    Array<{ id: string; createdAt: string; editorName: string }>
  >([]);

  const documentTypeItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const type of OFFICIAL_DOCUMENT_TYPES) {
      items[type] = tEnums(`officialDocumentType.${type}`);
    }
    return items;
  }, [tEnums]);

  const handoverVariantKeys = useMemo(
    () => listOfficialHandoverTemplateKeysForProject(projectName),
    [projectName]
  );

  const showHandoverVariantPicker =
    documentType === "HANDOVER_RECORD" &&
    handoverUsesOfficialMasters(projectName) &&
    handoverVariantKeys.length > 0;

  const missingFieldKeys = useMemo(
    () => listMissingFieldsInBody(editorBody),
    [editorBody]
  );

  const handoverVariantItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const key of handoverVariantKeys) {
      items[key] = t(officialHandoverVariantLabelKey(key));
    }
    return items;
  }, [handoverVariantKeys, t]);

  const handoverVariantLabel =
    (handoverTemplateKey && handoverVariantItems[handoverTemplateKey]) ||
    t("handoverVariantAuto");

  const documentTypeLabel =
    documentTypeItems[documentType] ?? tEnums(`officialDocumentType.${documentType}`);

  const needsRequest = Boolean(requiredRequestTypeForDocument(documentType));
  const requiredRequestType = requiredRequestTypeForDocument(documentType);

  const requestOptions = useMemo(
    () => filterApprovedRequestsForDocumentType(approvedRequests, requiredRequestType),
    [approvedRequests, requiredRequestType]
  );

  const resolvedUnitRequestId = useMemo(() => {
    const autoId = resolveAutoLinkedUnitRequestId({
      needsRequest,
      requestOptions,
      unitRequestId,
    });
    return autoId !== undefined ? autoId : unitRequestId;
  }, [needsRequest, requestOptions, unitRequestId]);

  const canEditNow = canEditOfficialDocumentDraftNow({
    needsRequest,
    unitRequestId: resolvedUnitRequestId,
  });

  const formatRequestLabel = (request: UnitRequestOption) =>
    formatApprovedUnitRequestOptionLabel({
      typeLabel: tEnums(`unitRequestType.${request.type}`),
      submittedAt: request.submittedAt,
      updatedAt: request.updatedAt,
      description: request.description,
      locale,
    });

  const linkedRequestItems = useMemo(() => {
    const items: Record<string, string> = {};
    if (!needsRequest) {
      items.__none__ = t("linkedRequestNone");
    }
    for (const req of requestOptions) {
      items[req.id] = formatRequestLabel(req);
    }
    return items;
  }, [needsRequest, requestOptions, t, locale, tEnums]);

  const linkedRequestValue = needsRequest
    ? resolvedUnitRequestId || null
    : resolvedUnitRequestId || "__none__";
  const selectedRequest = requestOptions.find((r) => r.id === resolvedUnitRequestId);
  const linkedRequestLabel = selectedRequest
    ? formatRequestLabel(selectedRequest)
    : needsRequest
      ? t("linkedRequestSelectApproved")
      : t("linkedRequestNone");

  const requiredRequestTypeLabel = requiredRequestType
    ? tEnums(`unitRequestType.${requiredRequestType}`)
    : "";

  const openEditor = (input: {
    draftId?: string;
    create?: boolean;
  }) => {
    startTransition(async () => {
      const result = await prepareOfficialDocumentTextDraftAction({
        unitId,
        documentType,
        locale,
        unitRequestId: resolvedUnitRequestId || null,
        draftId: input.draftId ?? null,
      });
      if (!result.success) {
        toast.error(result.error ?? t("draftPrepareFailed"));
        return;
      }
      if (!result.draftId) {
        toast.error(t("draftPrepareFailed"));
        return;
      }

      const detail = await getOfficialDocumentTextDraftAction(result.draftId);
      setActiveDraftId(result.draftId);
      setEditorTitle(result.title ?? detail?.title ?? "");
      setEditorBody(result.body ?? detail?.currentBody ?? "");
      setEditorLocale(result.locale ?? detail?.templateLocale ?? locale);
      setHandoverTemplateKey(
        (result.handoverTemplateKey ??
          detail?.handoverTemplateKey ??
          null) as HandoverTemplateKey | null
      );
      setVersionHistory(
        detail?.versions.map((v) => ({
          id: v.id,
          createdAt: v.createdAt.toISOString(),
          editorName: v.editedBy.name,
        })) ?? []
      );
      setEditorOpen(true);
    });
  };

  const openViewDraft = (draftId: string) => {
    startTransition(async () => {
      const detail = await getOfficialDocumentTextDraftAction(draftId);
      if (!detail) {
        toast.error(t("draftLoadFailed"));
        return;
      }
      setActiveDraftId(draftId);
      setEditorTitle(detail.title);
      setEditorBody(detail.currentBody);
      setEditorLocale(detail.templateLocale);
      setHandoverTemplateKey(
        (detail.handoverTemplateKey ?? null) as HandoverTemplateKey | null
      );
      setVersionHistory(
        detail.versions.map((v) => ({
          id: v.id,
          createdAt: v.createdAt.toISOString(),
          editorName: v.editedBy.name,
        }))
      );
      setEditorOpen(true);
    });
  };

  const applyHandoverVariant = (key: HandoverTemplateKey) => {
    if (!activeDraftId) return;
    startTransition(async () => {
      const result = await applyOfficialHandoverVariantAction({
        draftId: activeDraftId,
        handoverTemplateKey: key,
      });
      if (!result.success) {
        toast.error(result.error ?? t("handoverVariantApplyFailed"));
        return;
      }
      setHandoverTemplateKey(key);
      if (result.body) setEditorBody(result.body);
      if (result.title) setEditorTitle(result.title);
      if (result.handoverMissingFieldKeys?.length) {
        toast.warning(t("handoverMissingFieldsWarning"));
      }
      router.refresh();
    });
  };

  const saveDraft = () => {
    if (!activeDraftId) return;
    startTransition(async () => {
      const result = await saveOfficialDocumentTextDraftAction({
        draftId: activeDraftId,
        body: editorBody,
      });
      if (!result.success) {
        toast.error(result.error ?? t("draftSaveFailed"));
        return;
      }
      toast.success(t("draftSaved"));
      const detail = await getOfficialDocumentTextDraftAction(activeDraftId);
      setVersionHistory(
        detail?.versions.map((v) => ({
          id: v.id,
          createdAt: v.createdAt.toISOString(),
          editorName: v.editedBy.name,
        })) ?? []
      );
      router.refresh();
    });
  };

  const generatePdf = () => {
    if (!activeDraftId) return;
    startTransition(async () => {
      const result = await generateOfficialDocumentAction({
        unitId,
        textDraftId: activeDraftId,
      });
      if (!result.success) {
        toast.error(result.error ?? t("generateFailed"));
        return;
      }
      toast.success(t("generateSuccess"));
      setEditorOpen(false);
      router.refresh();
    });
  };

  const reopenVersion = (versionId: string) => {
    if (!activeDraftId) return;
    startTransition(async () => {
      const detail = await getOfficialDocumentTextDraftAction(activeDraftId);
      const version = detail?.versions.find((v) => v.id === versionId);
      if (!version) return;
      setEditorBody(version.body);
    });
  };

  const editorRtl = editorLocale === "ar";

  const showRequestBindingUi = canEditDraftText || canCreateUnitRequest;

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-4">
      <div>
        <h3 className="font-heading text-lg font-semibold">{t("panelTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("panelHint")}</p>
      </div>

      {showRequestBindingUi ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("documentType")}</Label>
            <Select
              value={documentType}
              items={documentTypeItems}
              onValueChange={(v) => {
                setDocumentType(v as OfficialDocumentType);
                setUnitRequestId("");
              }}
            >
              <SelectTrigger>
                <SelectValue>{documentTypeLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {OFFICIAL_DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {tEnums(`officialDocumentType.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("linkedRequest")}</Label>
            <Select
              value={linkedRequestValue}
              items={linkedRequestItems}
              onValueChange={(v) =>
                setUnitRequestId(v && v !== "__none__" ? v : "")
              }
            >
              <SelectTrigger
                disabled={needsRequest && requestOptions.length === 0}
                className="w-full"
              >
                <SelectValue
                  placeholder={
                    needsRequest ? t("linkedRequestSelectApproved") : t("linkedRequestOptional")
                  }
                >
                  {linkedRequestLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {!needsRequest ? (
                  <SelectItem value="__none__">{t("linkedRequestNone")}</SelectItem>
                ) : null}
                {requestOptions.map((req) => (
                  <SelectItem key={req.id} value={req.id}>
                    {formatRequestLabel(req)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {needsRequest && requestOptions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-sm">
                <p className="text-muted-foreground">
                  {t("noApprovedRequestNotice", { type: requiredRequestTypeLabel })}
                </p>
                {canCreateUnitRequest && requiredRequestType ? (
                  <Button
                    type="button"
                    className="mt-2"
                    size="sm"
                    variant="outline"
                    render={
                      <Link
                        href={buildPrefilledCreateUnitRequestHref({
                          unitId,
                          requestType: requiredRequestType,
                        })}
                      />
                    }
                  >
                    {t("createRequestType", { type: requiredRequestTypeLabel })}
                  </Button>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("askCsToCreateRequest", { type: requiredRequestTypeLabel })}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("linkedRequestHint")}</p>
            )}
          </div>
          {canEditDraftText ? (
            <div className="sm:col-span-2">
              <Button
                type="button"
                disabled={pending || !canEditNow}
                onClick={() => openEditor({ create: true })}
              >
                {t("editText")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("viewOnlyHint")}</p>
      )}

      {textDrafts.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">{t("textDraftsTitle")}</h4>
          <ul className="divide-y divide-border/50 rounded-lg border border-border/40">
            {textDrafts.map((draft) => (
              <li
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm [dir=rtl]:flex-row-reverse"
              >
                <div>
                  <p className="font-medium">{draft.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {tEnums(`officialDocumentType.${draft.documentType}`)}
                    {" · "}
                    {draft.templateLocale} · {t("draftVersionCount", { count: draft.versionCount })}
                    {" · "}
                    {draft.updatedByName}
                  </p>
                </div>
                {canEditDraftText ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => openEditor({ draftId: draft.id })}
                  >
                    {t("reopenDraft")}
                  </Button>
                ) : canViewDraftText ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => openViewDraft(draft.id)}
                  >
                    {t("viewDraft")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="divide-y divide-border/50 rounded-lg border border-border/40">
        {generatedDocuments.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">{t("empty")}</li>
        ) : (
          generatedDocuments.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm [dir=rtl]:flex-row-reverse"
            >
              <div>
                <p className="font-medium">{doc.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {tEnums(`officialDocumentType.${doc.documentType}`)}
                  {" · "}
                  v{doc.templateVersion} ({doc.templateLocale}) · {doc.generatedBy.name}
                </p>
              </div>
              <div className="flex items-center gap-2 [dir=rtl]:flex-row-reverse">
                {doc.signedCopyOnFileAt ? (
                  <Badge variant="secondary">{t("signedOnFile")}</Badge>
                ) : (
                  <Badge variant="outline">{t("draftWatermark")}</Badge>
                )}
                <Button variant="outline" size="sm" render={
                  <a
                    href={`/api/units/${unitId}/generated-documents/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }>
                  {t("downloadPdf")}
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("editTextDialogTitle")}</DialogTitle>
            <p className="text-sm text-muted-foreground">{editorTitle}</p>
          </DialogHeader>
          {showHandoverVariantPicker && canEditDraftText ? (
            <div className="space-y-1.5">
              <Label>{t("handoverVariantLabel")}</Label>
              <Select
                value={handoverTemplateKey ?? handoverVariantKeys[0]!}
                items={handoverVariantItems}
                onValueChange={(v) =>
                  applyHandoverVariant(v as HandoverTemplateKey)
                }
              >
                <SelectTrigger>
                  <SelectValue>{handoverVariantLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {handoverVariantKeys.map((key) => (
                    <SelectItem key={key} value={key}>
                      {handoverVariantItems[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("handoverVariantHint")}
              </p>
            </div>
          ) : null}
          {missingFieldKeys.length > 0 ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              <p className="font-medium">{t("handoverMissingFieldsWarning")}</p>
              <ul className="mt-1 list-inside list-disc text-xs">
                {missingFieldKeys.map((key) => (
                  <li key={key}>
                    {officialHandoverMissingFieldLabel(key, editorLocale)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Textarea
            value={editorBody}
            onChange={(e) => setEditorBody(e.target.value)}
            readOnly={!canEditDraftText}
            rows={18}
            dir={editorRtl ? "rtl" : "ltr"}
            className={cn(
              "min-h-[320px] font-mono text-sm leading-relaxed",
              editorRtl && "font-[family-name:var(--font-arabic)] text-right",
              missingFieldKeys.length > 0 && "ring-1 ring-amber-500/50"
            )}
          />
          {versionHistory.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {t("versionHistory")}
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {versionHistory.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {v.editorName} · {new Date(v.createdAt).toLocaleString(locale)}
                    </span>
                    {canEditDraftText ? (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => reopenVersion(v.id)}
                      >
                        {t("loadVersion")}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-start">
            {canEditDraftText ? (
              <Button type="button" variant="secondary" disabled={pending} onClick={saveDraft}>
                {t("saveDraftText")}
              </Button>
            ) : null}
            {canGeneratePdf ? (
              <Button
                type="button"
                disabled={pending || missingFieldKeys.length > 0}
                onClick={generatePdf}
              >
                {pending ? t("generating") : t("generateDraft")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
