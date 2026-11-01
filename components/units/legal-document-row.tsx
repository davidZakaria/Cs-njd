"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deriveLegalDocumentUiStatus,
  type LegalDocumentUiStatus,
} from "@/lib/units/legal-document-ui-status";
import { cn } from "@/lib/utils";

const STATUS_BADGE_VARIANT: Record<
  LegalDocumentUiStatus,
  "destructive" | "secondary" | "outline" | "default"
> = {
  missing: "outline",
  signed_no_file: "secondary",
  file_uploaded: "default",
  needs_update: "destructive",
};

export function LegalDocumentRow({
  documentName,
  paperSigned,
  hasFile,
  needsUpdate,
  dateId,
  dateValue,
  onDateChange,
  dateDisabled,
  checkId,
  checked,
  onCheckChange,
  checkDisabled,
  managementOnlyLabel,
  uploadSlot,
  hint,
}: {
  documentName: string;
  paperSigned: boolean;
  hasFile: boolean;
  needsUpdate: boolean;
  dateId: string;
  dateValue: string;
  onDateChange: (value: string) => void;
  dateDisabled: boolean;
  checkId: string;
  checked: boolean;
  onCheckChange: (value: boolean) => void;
  checkDisabled: boolean;
  managementOnlyLabel?: string;
  uploadSlot?: ReactNode;
  hint?: string;
}) {
  const tForm = useTranslations("workflow.contractsHandover");
  const tStatus = useTranslations("workflow.legalDocumentStatus");

  const status = deriveLegalDocumentUiStatus({
    paperSigned,
    hasFile,
    needsUpdate,
  });

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug">
            {documentName}
            {managementOnlyLabel ? (
              <span className="ms-1 text-xs font-normal text-muted-foreground">
                ({managementOnlyLabel})
              </span>
            ) : null}
          </p>
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <Badge
          variant={STATUS_BADGE_VARIANT[status]}
          className={cn(
            "shrink-0 font-normal",
            status === "needs_update" &&
              "border-amber-600/50 bg-amber-500/15 text-amber-900 dark:text-amber-200"
          )}
        >
          {tStatus(status)}
        </Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-3">
          <div className="space-y-1 sm:max-w-xs">
            <Label htmlFor={dateId} className="text-xs text-muted-foreground">
              {tForm("datedOn")}
            </Label>
            <Input
              id={dateId}
              type="date"
              disabled={dateDisabled}
              value={dateValue}
              onChange={(event) => onDateChange(event.target.value)}
            />
          </div>
          {uploadSlot ? (
            <div className="min-w-0">{uploadSlot}</div>
          ) : null}
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border/50 bg-muted/20 p-2.5 lg:min-w-[12rem]">
          <input
            id={checkId}
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 rounded border"
            checked={checked}
            disabled={checkDisabled}
            onChange={(event) => onCheckChange(event.target.checked)}
          />
          <Label htmlFor={checkId} className="text-sm font-normal leading-snug">
            {tForm("signedPaperOnly")}
          </Label>
        </div>
      </div>
    </div>
  );
}
