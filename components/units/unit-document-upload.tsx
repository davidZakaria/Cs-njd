"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import {
  removeUnitDocument,
  uploadUnitDocument,
} from "@/lib/actions/unit-documents";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  UNIT_DOCUMENT_API_SEGMENT,
  type UnitDocumentKind,
} from "@/lib/uploads/unit-document-constants";
import { cn } from "@/lib/utils";

const I18N_PREFIX: Record<UnitDocumentKind, string> = {
  signedContract: "signedContract",
  extensionAnnex: "extensionAnnex",
  finishingContract: "finishingContract",
};

export function UnitDocumentUpload({
  unitId,
  documentType,
  existingFile,
  canView = true,
  canUploadWhenEmpty = false,
  canManageFiles = false,
  /** Legacy: upload, replace, and delete when true. */
  canUpload,
  required = false,
  variant = "card",
}: {
  unitId: string;
  documentType: UnitDocumentKind;
  existingFile: string | null;
  canView?: boolean;
  canUploadWhenEmpty?: boolean;
  canManageFiles?: boolean;
  canUpload?: boolean;
  required?: boolean;
  variant?: "card" | "embedded";
}) {
  const legacyMode =
    canUpload !== undefined && !canUploadWhenEmpty && !canManageFiles;
  const resolvedUploadWhenEmpty = legacyMode
    ? Boolean(canUpload)
    : canUploadWhenEmpty;
  const resolvedManageFiles = legacyMode ? Boolean(canUpload) : canManageFiles;

  const prefix = I18N_PREFIX[documentType];
  const t = useTranslations(`documents.${prefix}`);
  const tDocs = useTranslations("documents");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { pending, runAction } = useCrudToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const hasFile = Boolean(existingFile);
  const downloadHref = `/api/units/${unitId}/${UNIT_DOCUMENT_API_SEGMENT[documentType]}`;
  const mayUpload = resolvedManageFiles || (resolvedUploadWhenEmpty && !hasFile);
  const showUploadSection = mayUpload && (!hasFile || resolvedManageFiles);

  function handleFileChange() {
    const file = inputRef.current?.files?.[0];
    setSelectedName(file?.name ?? null);
  }

  function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("unitId", unitId);
    formData.append("documentType", documentType);
    formData.append("file", file);

    runAction(async () => {
      const result = await uploadUnitDocument(formData);
      if (result.success && inputRef.current) {
        inputRef.current.value = "";
        setSelectedName(null);
        router.refresh();
      }
      return result;
    }, "saved");
  }

  function handleRemove() {
    if (!confirm(tDocs("removeConfirm"))) return;
    runAction(async () => {
      const result = await removeUnitDocument(unitId, documentType);
      if (result.success) router.refresh();
      return result;
    }, "deleted");
  }

  if (!hasFile && !mayUpload && !canView) {
    return null;
  }

  const body = (
    <div className={cn("space-y-4", variant === "embedded" && "space-y-3")}>
      {variant === "embedded" ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("title")}</p>
          {documentType === "extensionAnnex" ? (
            <p className="text-xs text-muted-foreground">
              {t("gracePeriodHint")}
            </p>
          ) : null}
        </div>
      ) : null}

      {hasFile && canView ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
          <div className="flex min-w-0 items-start gap-2">
            <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="truncate text-sm font-medium">{existingFile}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={downloadHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t("view")}
            </a>
            {resolvedManageFiles ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={handleRemove}
              >
                <Trash2 className="size-3.5" />
                {tCommon("delete")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : !hasFile ? (
        <p
          className={cn(
            "text-sm font-medium",
            required
              ? "text-amber-700 dark:text-amber-400"
              : "text-muted-foreground"
          )}
        >
          {t("missing")}
        </p>
      ) : null}

      {hasFile && !resolvedManageFiles && resolvedUploadWhenEmpty ? (
        <p className="text-xs text-muted-foreground">{tDocs("uploadLocked")}</p>
      ) : null}

      {showUploadSection ? (
        <div
          className={cn(
            "space-y-2",
            variant === "card" ? "border-t border-border/50 pt-4" : ""
          )}
        >
          <p className="text-sm font-medium">
            {hasFile && resolvedManageFiles ? t("replace") : t("upload")}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf,image/jpeg,image/png,.jpg,.png"
            className="block w-full max-w-md text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
            disabled={pending}
            onChange={handleFileChange}
          />
          {selectedName ? (
            <p className="text-xs text-muted-foreground">{selectedName}</p>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={pending || !selectedName}
            onClick={handleUpload}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {hasFile && resolvedManageFiles ? t("replace") : t("upload")}
          </Button>
        </div>
      ) : null}
    </div>
  );

  if (variant === "embedded") {
    if (!hasFile && !mayUpload) return null;
    return (
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">{body}</div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <Badge
          variant={required ? "destructive" : "secondary"}
          className="shrink-0 font-normal"
        >
          {required ? tDocs("requiredBadge") : tDocs("optionalBadge")}
        </Badge>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
