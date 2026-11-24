"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AuditRecordCell({
  recordId,
  recordLabel,
}: {
  recordId: string;
  recordLabel: string | null;
}) {
  const t = useTranslations("audit");
  const [copied, setCopied] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(recordId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const primary = recordLabel ?? recordId;

  return (
    <div className="flex max-w-[14rem] items-start gap-1">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-sm">{primary}</div>
        {recordLabel ? (
          <div className="truncate font-mono text-[10px] text-muted-foreground">
            {recordId}
          </div>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn("shrink-0")}
        onClick={(e) => {
          e.stopPropagation();
          void copyId();
        }}
        aria-label={t("copyRecordId")}
        title={t("copyRecordId")}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}