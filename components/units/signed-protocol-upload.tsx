"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import {
  removeSignedProtocol,
  uploadSignedProtocol,
} from "@/lib/actions/signed-protocol";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SignedProtocolInfo = {
  unitId: string;
  originalName: string | null;
  uploadedAtLabel: string | null;
  uploadedByLabel: string | null;
  sizeLabel: string | null;
  hasFile: boolean;
};

export function SignedProtocolUpload({
  info,
  canUpload,
  canManageFiles = true,
  hasResolvedCase = false,
  variant = "card",
}: {
  info: SignedProtocolInfo;
  canUpload: boolean;
  /** Replace or delete an existing handover protocol file. */
  canManageFiles?: boolean;
  hasResolvedCase?: boolean;
  variant?: "card" | "inline";
}) {
  const t = useTranslations("workflow.signedProtocol");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { pending, runAction } = useCrudToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const downloadHref = `/api/units/${info.unitId}/signed-protocol`;
  const showUploadControls =
    canUpload && (!info.hasFile || canManageFiles);

  function handleFileChange() {
    const file = inputRef.current?.files?.[0];
    setSelectedName(file?.name ?? null);
  }

  function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("unitId", info.unitId);
    formData.append("file", file);

    runAction(async () => {
      const result = await uploadSignedProtocol(formData);
      if (result.success && inputRef.current) {
        inputRef.current.value = "";
        setSelectedName(null);
        router.refresh();
      }
      return result;
    }, "saved", t("uploadSuccess"));
  }

  function handleRemove() {
    if (!confirm(t("removeConfirm"))) return;
    runAction(async () => {
      const result = await removeSignedProtocol(info.unitId);
      if (result.success) router.refresh();
      return result;
    }, "deleted", t("removeSuccess"));
  }

  const inlineUploadControls = showUploadControls ? (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
        className="max-w-[14rem] flex-1 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary-foreground"
        disabled={pending}
        onChange={handleFileChange}
      />
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1 shrink-0"
        disabled={pending || !selectedName}
        onClick={handleUpload}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Upload className="size-3.5" />
        )}
        {info.hasFile ? t("replaceButton") : t("uploadButton")}
      </Button>
    </div>
  ) : null;

  if (variant === "inline") {
    if (!info.hasFile && !showUploadControls) {
      return null;
    }
    return (
      <div className="space-y-2">
        {info.hasFile ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2">
            <FileText className="size-4 shrink-0 text-primary" />
            <p className="min-w-0 flex-1 truncate text-sm">
              {info.originalName ?? t("title")}
            </p>
            <a
              href={downloadHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t("viewDownload")}
            </a>
            {canManageFiles ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-destructive hover:text-destructive"
                disabled={pending}
                onClick={handleRemove}
              >
                <Trash2 className="size-3.5" />
                {tCommon("delete")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {inlineUploadControls}
        {selectedName && showUploadControls ? (
          <p className="text-xs text-muted-foreground">{selectedName}</p>
        ) : null}
      </div>
    );
  }

  if (!info.hasFile && !showUploadControls) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {hasResolvedCase ? t("afterResolveHint") : t("beforeResolveHint")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        {info.hasFile ? (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
            <div className="flex min-w-0 items-start gap-2">
              <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 space-y-0.5 text-sm">
                <p className="truncate font-medium">{info.originalName}</p>
                {info.uploadedAtLabel ? (
                  <p className="text-muted-foreground">
                    {t("uploadedAt", { date: info.uploadedAtLabel })}
                  </p>
                ) : null}
                {info.uploadedByLabel ? (
                  <p className="text-muted-foreground">
                    {t("uploadedBy", { name: info.uploadedByLabel })}
                  </p>
                ) : null}
                {info.sizeLabel ? (
                  <p className="text-muted-foreground">{info.sizeLabel}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {t("viewDownload")}
              </a>
              {canManageFiles ? (
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
        ) : (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {t("missingFile")}
          </p>
        )}

        {showUploadControls ? (
          <div className="space-y-2 border-t border-border/50 pt-4">
            <p className="text-sm font-medium">
              {info.hasFile ? t("replaceLabel") : t("uploadLabel")}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
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
              <Upload className="size-4" />
              {info.hasFile ? t("replaceButton") : t("uploadButton")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
