"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import type { OfficialDocumentType, UnitRequestType } from "@prisma/client";

import {
  generateOfficialDocumentAction,
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
import { requiredRequestTypeForDocument } from "@/lib/official-documents/request-binding";
import { cn } from "@/lib/utils";

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
};

export function UnitOfficialDocumentsPanel({
  unitId,
  canEditDraftText,
  canGeneratePdf,
  generatedDocuments,
  textDrafts,
  approvedRequests,
}: {
  unitId: string;
  canEditDraftText: boolean;
  canGeneratePdf: boolean;
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

  const documentTypeLabel =
    documentTypeItems[documentType] ?? tEnums(`officialDocumentType.${documentType}`);

  const linkedRequestItems = useMemo(() => {
    const required = requiredRequestTypeForDocument(documentType);
    const options = approvedRequests.filter((r) =>
      required ? r.type === required : true
    );
    const items: Record<string, string> = {
      __none__: t("linkedRequestNone"),
    };
    for (const req of options) {
      items[req.id] = `${tEnums(`unitRequestType.${req.type}`)} — ${req.id.slice(0, 8)}`;
    }
    return items;
  }, [approvedRequests, documentType, t, tEnums]);

  const linkedRequestValue = unitRequestId || "__none__";
  const linkedRequestLabel =
    linkedRequestItems[linkedRequestValue] ?? t("linkedRequestNone");

  const requestOptions = useMemo(() => {
    const required = requiredRequestTypeForDocument(documentType);
    return approvedRequests.filter((r) =>
      required ? r.type === required : true
    );
  }, [approvedRequests, documentType]);

  const openEditor = (input: {
    draftId?: string;
    create?: boolean;
  }) => {
    startTransition(async () => {
      const result = await prepareOfficialDocumentTextDraftAction({
        unitId,
        documentType,
        locale,
        unitRequestId: unitRequestId || null,
        draftId: input.draftId ?? null,
      });
      if (!result.success || !result.draftId) {
        toast.error(result.error ?? t("draftPrepareFailed"));
        return;
      }

      const detail = await getOfficialDocumentTextDraftAction(result.draftId);
      setActiveDraftId(result.draftId);
      setEditorTitle(result.title ?? detail?.title ?? "");
      setEditorBody(result.body ?? detail?.currentBody ?? "");
      setEditorLocale(result.locale ?? detail?.templateLocale ?? locale);
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

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-4">
      <div>
        <h3 className="font-heading text-lg font-semibold">{t("panelTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("panelHint")}</p>
      </div>

      {canEditDraftText ? (
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
              <SelectTrigger>
                <SelectValue placeholder={t("linkedRequestOptional")}>
                  {linkedRequestLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {!requiredRequestTypeForDocument(documentType) ? (
                  <SelectItem value="__none__">{t("linkedRequestNone")}</SelectItem>
                ) : null}
                {requestOptions.map((req) => (
                  <SelectItem key={req.id} value={req.id}>
                    {tEnums(`unitRequestType.${req.type}`)} — {req.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("linkedRequestHint")}</p>
          </div>
          <div className="sm:col-span-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => openEditor({ create: true })}
            >
              {t("editText")}
            </Button>
          </div>
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
          <Textarea
            value={editorBody}
            onChange={(e) => setEditorBody(e.target.value)}
            rows={18}
            dir={editorRtl ? "rtl" : "ltr"}
            className={cn(
              "min-h-[320px] font-mono text-sm leading-relaxed",
              editorRtl && "font-[family-name:var(--font-arabic)] text-right"
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
              <Button type="button" disabled={pending} onClick={generatePdf}>
                {pending ? t("generating") : t("generateDraft")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
