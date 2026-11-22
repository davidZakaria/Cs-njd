"use client";

import { AlertTriangle, Check, Clock, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { ActivityNotificationItem } from "@/lib/actions/notifications";
import { formatDateTime } from "@/lib/format/datetime";
import { formatRelativeActivityTime } from "@/lib/format/relative-time";
import { roleShowsCallLogSeenStatus } from "@/lib/notifications/call-log-seen-types";
import type { CallLogSeenInfo } from "@/lib/notifications/call-log-seen-types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusBadgeClass =
  "h-auto min-h-5 w-full max-w-full shrink-0 justify-start whitespace-nowrap sm:max-w-[16rem]";

function CallLogSeenBadge({
  seen,
  locale,
}: {
  seen: CallLogSeenInfo;
  locale: string;
}) {
  const t = useTranslations("activityNotifications.callLogSeen");

  if (seen.kind === "no_agent") {
    const label = t("noCsAgent");
    return (
      <Badge
        variant="outline"
        title={label}
        className={cn(
          statusBadgeClass,
          "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300"
        )}
      >
        <AlertTriangle className="size-3 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{label}</span>
      </Badge>
    );
  }

  if (seen.kind === "seen" && seen.agentName && seen.readAt) {
    const time = formatDateTime(seen.readAt, locale, {
      timeStyle: "short",
    });
    const label = t("seenBadge", { agent: seen.agentName, time });
    return (
      <Badge
        variant="outline"
        title={label}
        className={cn(
          statusBadgeClass,
          "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
        )}
      >
        <Check className="size-3 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{label}</span>
      </Badge>
    );
  }

  const label = t("notSeenYet");
  return (
    <Badge
      variant="outline"
      title={label}
      className={cn(
        statusBadgeClass,
        "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
      )}
    >
      <Clock className="size-3 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </Badge>
  );
}

export function CallLogInboxRow({
  item,
  pending,
  viewerRole,
  onClick,
}: {
  item: ActivityNotificationItem;
  pending: boolean;
  viewerRole: string;
  onClick: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("activityNotifications");
  const display = item.callLogDisplay;
  const showSeenBadge =
    roleShowsCallLogSeenStatus(viewerRole) &&
    item.callLogSeen != null;

  const fullTime = formatDateTime(item.createdAt, locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const relative = formatRelativeActivityTime(item.createdAt, locale);

  return (
    <li>
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className={cn(
          "group flex w-full min-w-0 flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 text-start shadow-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-stretch sm:p-4",
          !item.isRead &&
            "border-s-[3px] border-s-primary bg-primary/[0.03] ps-[calc(0.75rem-1px)] sm:ps-[calc(1rem-1px)]"
        )}
      >
        <div className="flex min-w-0 gap-3 sm:flex-1">
        <div
          className={cn(
            "relative mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
            !item.isRead && "bg-primary/15"
          )}
        >
          <Phone className="size-4" aria-hidden />
          {!item.isRead ? (
            <span className="absolute -start-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-card" />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 flex-col gap-1.5 flex">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {display ? (
              <>
                <span className="break-words text-sm font-semibold leading-snug text-foreground">
                  {display.unitCode}
                  <span className="font-normal text-muted-foreground">
                    {" · "}
                    {display.projectName}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {display.clientName}
                </span>
              </>
            ) : (
              <span className="text-sm font-semibold">{item.title}</span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {display ? (
              <>
                {t("loggedBy", { name: display.loggerName })}{" "}
                <time
                  dateTime={item.createdAt}
                  title={fullTime}
                  className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
                >
                  {relative}
                </time>
              </>
            ) : (
              <time dateTime={item.createdAt} title={fullTime}>
                {relative}
              </time>
            )}
          </p>

          {display?.notesSnippet ? (
            <blockquote className="line-clamp-2 border-s-2 border-border/80 ps-2 text-sm leading-snug text-foreground">
              {display.notesSnippet}
            </blockquote>
          ) : !display ? (
            <p className="line-clamp-2 text-sm text-foreground">{item.message}</p>
          ) : null}
        </div>
        </div>

        {showSeenBadge && item.callLogSeen ? (
          <div className="flex w-full min-w-0 items-start sm:w-auto sm:shrink-0 sm:pt-0.5">
            <CallLogSeenBadge seen={item.callLogSeen} locale={locale} />
          </div>
        ) : null}
      </button>
    </li>
  );
}