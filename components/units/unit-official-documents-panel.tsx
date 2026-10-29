"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import type { OfficialDocumentType, UnitRequestType } from "@prisma/client";

import { generateOfficialDocumentAction } from "@/lib/actions/official-documents";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { OFFICIAL_DOCUMENT_TYPES } from "@/lib/official-documents/types";
import { requiredRequestTypeForDocument } from "@/lib/official-documents/request-binding";

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

export type UnitRequestOption = {
  id: string;
  type: UnitRequestType;
  status: string;
};

export function UnitOfficialDocumentsPanel({
  unitId,
  canGenerate,
  generatedDocuments,
  approvedRequests,
}: {
  unitId: string;
  canGenerate: boolean;
  generatedDocuments: GeneratedRow[];
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

  const requestOptions = useMemo(() => {
    const required = requiredRequestTypeForDocument(documentType);
    return approvedRequests.filter((r) =>
      required ? r.type === required : true
    );
  }, [approvedRequests, documentType]);

  const generate = () => {
    startTransition(async () => {
      const result = await generateOfficialDocumentAction({
        unitId,
        documentType,
        locale,
        unitRequestId: unitRequestId || null,
      });
      if (!result.success) {
        toast.error(result.error ?? t("generateFailed"));
        return;
      }
      toast.success(t("generateSuccess"));
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-4">
      <div>
        <h3 className="font-heading text-lg font-semibold">{t("panelTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("panelHint")}</p>
      </div>

      {canGenerate ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("documentType")}</Label>
            <Select
              value={documentType}
              onValueChange={(v) => {
                setDocumentType(v as OfficialDocumentType);
                setUnitRequestId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
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
              value={unitRequestId || "__none__"}
              onValueChange={(v) =>
                setUnitRequestId(v && v !== "__none__" ? v : "")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("linkedRequestOptional")} />
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
            <Button type="button" disabled={pending} onClick={generate}>
              {pending ? t("generating") : t("generateDraft")}
            </Button>
          </div>
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
    </div>
  );
}
