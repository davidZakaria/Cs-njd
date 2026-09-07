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
  onExtractedId,
}: {
  unitId: string;
  clientId: string | null;
  hasFile: boolean;
  canUpload: boolean;
  onExtractedId?: (nationalId: string) => void;
}) {
  const t = useTranslations("client");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { pending, runAction } = useCrudToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const viewHref = `/api/units/${unitId}/national-id`;
  const uploadDisabled = !canUpload || !clientId || pending || scanning;

  function handleFileChange() {
    const file = inputRef.current?.files?.[0];
    setSelectedName(file?.name ?? null);
  }

  async function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file || !clientId) return;

    const formData = new FormData();
    formData.append("unitId", unitId);
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
      router.refresh();

      if (result.extractedId) {
        onExtractedId?.(result.extractedId);
        toast.success(t("ocr.success"));
      } else if (isImage) {
        toast.warning(t("ocr.failed"));
      } else {
        toast.success(tCommon("savedSuccess"));
      }
    } finally {
      setScanning(false);
    }
  }

  function handleRemove() {
    if (!confirm(t("removeConfirm"))) return;
    runAction(async () => {
      const result = await removeNationalId(unitId);
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

  if (!canUpload && !hasFile) {
    return null;
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t("nationalIdFile")}
      </p>
      {hasFile ? (
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
          {canUpload ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
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
                disabled={uploadDisabled}
                onClick={handleRemove}
              >
                <Trash2 className="size-4" />
                {t("removeId")}
              </Button>
            </>
          ) : null}
        </div>
      ) : canUpload ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
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
