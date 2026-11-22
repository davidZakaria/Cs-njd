"use client";

import { useTranslations, useLocale } from "next-intl";

import type { CallLogSeenInfo } from "@/lib/notifications/call-log-seen-types";
import { formatDateTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";

export function CallLogSeenLabel({
  seen,
  className,
}: {
  seen: CallLogSeenInfo;
  className?: string;
}) {
  const t = useTranslations("activityNotifications.callLogSeen");
  const locale = useLocale();

  if (seen.kind === "no_agent") {
    return (
      <p
        className={cn(
          "text-xs font-medium text-amber-700 dark:text-amber-400",
          className
        )}
      >
        {t("noCsAgent")}
      </p>
    );
  }

  if (seen.kind === "seen" && seen.agentName && seen.readAt) {
    const time = formatDateTime(seen.readAt, locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        {t("seenBy", { agent: seen.agentName, time })}
      </p>
    );
  }

  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {t("notSeenYet")}
    </p>
  );
}