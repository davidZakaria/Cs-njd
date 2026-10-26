"use client";

import { useRef, useState } from "react";
import { ExternalLink, Loader2, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { removeNationalId, uploadNationalId } from "@/lib/actions/national-id";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NationalIdUpload({
  unitId,
  clientId,
  hasFile,
  canUpload,
  canManageFiles = false,
  onExtractedId,
}: {
  unitId: string;
  clientId: string | null;
  hasFile: boolean;
  /** May upload when no file is on record. */
  canUpload: boolean;
  /** Replace or remove an existing scan (management). */
  canManageFiles?: boolean;
  onExtractedId?: (nationalId: string) => void;
}) {
  const t = useTranslations("client");
  const tDocs = useTranslations("documents");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { pending, runAction } = useCrudToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const mayUploadNew = canUpload && !hasFile;
  const mayManage = canManageFiles;
  const canView = hasFile && (canUpload || canManageFiles);

  const viewHref = clientId
    ? `/api/units/${unitId}/national-id?clientId=${encodeURIComponent(clientId)}`
    : `/api/units/${unitId}/national-id`;
  const uploadDisabled = !mayUploadNew && !mayManage || !clientId || pending || scanning;

  function handleFileChange() {
    const file = inputRef.current?.files?.[0];
    setSelectedName(file?.name ?? null);
  }

  async function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file || !clientId) return;
    if (!mayUploadNew && !mayManage) return;

    const formData = new FormData();
    formData.append("unitId", unitId);
    if (clientId) formData.append("clientId", clientId);
    formData.append("file", file);
    const isImage = file.type.startsWith("image/");

    setScanning(true);
    try {
      const result = await uploadNationalId(formData);
      if (!result.success) {
        toast.error(result.error || tCommon("actionFailed"));
        return;
      }

      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setSelectedName(null);

      if (result.extractedId) {
        onExtractedId?.(result.extractedId);
        toast.success(t("ocr.success"));
      } else if (isImage) {
        toast.warning(t("ocr.failed"));
      } else {
        toast.success(tCommon("savedSuccess"));
      }

      router.refresh();
    } finally {
      setScanning(false);
    }
  }

  function handleRemove() {
    if (!confirm(t("removeConfirm"))) return;
    runAction(async () => {
      const result = await removeNationalId(unitId, clientId ?? undefined);
      if (result.success) {
        router.refresh();
      }
      return result;
    }, "deleted", t("removeSuccess"));
  }

  const uploadButtonLabel = scanning
    ? t("ocr.scanning")
    : pending
      ? t("uploading")
      : t("uploadId");

  if (!canView && !mayUploadNew && !mayManage) {
    return null;
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t("nationalIdFile")}
      </p>
      {canView ? (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={viewHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ExternalLink className="size-4" />
            {t("viewId")}
          </a>
          {mayManage ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,.jpg,.png"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploadDisabled}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-4" />
                {t("replaceId")}
              </Button>
              {selectedName ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={uploadDisabled}
                  onClick={handleUpload}
                >
                  {scanning ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {uploadButtonLabel}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={handleRemove}
              >
                <Trash2 className="size-4" />
                {t("removeId")}
              </Button>
            </>
          ) : canUpload ? (
            <p className="text-xs text-muted-foreground">{tDocs("uploadLocked")}</p>
          ) : null}
        </div>
      ) : mayUploadNew ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,.jpg,.png"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploadDisabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            {selectedName ?? t("uploadId")}
          </Button>
          {selectedName ? (
            <Button
              type="button"
              size="sm"
              disabled={uploadDisabled}
              onClick={handleUpload}
            >
              {scanning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {uploadButtonLabel}
            </Button>
          ) : null}
          {!clientId ? (
            <p className="text-xs text-muted-foreground">{t("uploadRequiresClient")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
