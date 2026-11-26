"use client";

import { useLocale, useTranslations } from "next-intl";

import { buildAuditFieldDiff } from "@/lib/audit/diff";
import { maskSensitiveSnapshotForDisplay } from "@/lib/audit/mask-sensitive";
import { cn } from "@/lib/utils";

export function AuditLogDiffPanel({
  tableName,
  oldData,
  newData,
  referenceLabels,
}: {
  tableName: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  referenceLabels?: Record<string, string>;
}) {
  const locale = useLocale();
  const t = useTranslations("audit");
  const lang = locale === "ar" ? "ar" : "en";

  const maskedOld = maskSensitiveSnapshotForDisplay(oldData);
  const maskedNew = maskSensitiveSnapshotForDisplay(newData);
  const labelsMap = referenceLabels
    ? new Map(Object.entries(referenceLabels))
    : undefined;
  const rows = buildAuditFieldDiff(
    tableName,
    maskedOld,
    maskedNew,
    lang,
    labelsMap
  );
  const changed = rows.filter((row) => row.changed);

  if (!changed.length) {
    return (
      <p className="text-sm text-muted-foreground">{t("diff.noChanges")}</p>
    );
  }

  return (
    <div
      className="space-y-2"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-xs font-medium text-muted-foreground">
        <span>{t("diff.before")}</span>
        <span />
        <span>{t("diff.after")}</span>
      </div>
      <ul className="space-y-2">
        {changed.map((row) => (
          <li
            key={row.fieldKey}
            className="rounded-md border bg-muted/30 p-3 text-sm"
          >
            <div className="mb-2 font-medium">{row.label}</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
              <span className="break-words text-muted-foreground">{row.before}</span>
              <span className="text-muted-foreground">→</span>
              <span className={cn("break-words", row.changed && "font-medium")}>
                {row.after}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}