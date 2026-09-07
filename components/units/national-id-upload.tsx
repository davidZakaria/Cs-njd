"use client";

import { useRef, useState } from "react";
import { ExternalLink, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { uploadNationalId } from "@/lib/actions/national-id";
import { useCrudToast } from "@/hooks/use-crud-toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NationalIdUpload({
  unitId,
  clientId,
  hasFile,
  canUpload,
}: {
  unitId: string;
  clientId: string | null;
  hasFile: boolean;
  canUpload: boolean;
}) {
  const t = useTranslations("client");
  const router = useRouter();
  const { pending, runAction } = useCrudToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const viewHref = `/api/units/${unitId}/national-id`;
  const uploadDisabled = !canUpload || !clientId || pending;

  function handleFileChange() {
    const file = inputRef.current?.files?.[0];
    setSelectedName(file?.name ?? null);
  }

  function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file || !clientId) return;

    const formData = new FormData();
    formData.append("unitId", unitId);
    formData.append("file", file);

    runAction(async () => {
      const result = await uploadNationalId(formData);
      if (result.success && inputRef.current) {
        inputRef.current.value = "";
        setSelectedName(null);
        router.refresh();
      }
      return result;
    }, "saved");
  }

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
                  {pending ? t("uploading") : t("uploadId")}
                </Button>
              ) : null}
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
            <Button type="button" size="sm" disabled={uploadDisabled} onClick={handleUpload}>
              {pending ? t("uploading") : t("uploadId")}
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
