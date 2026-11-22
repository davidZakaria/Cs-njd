"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { ActivityNotificationItem } from "@/lib/actions/notifications";
import { CallLogInboxRow } from "@/components/notifications/call-log-inbox-row";
import { roleShowsCallLogSeenStatus } from "@/lib/notifications/call-log-seen-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CallLogInboxFilter = "all" | "not_seen" | "no_agent";

function matchesFilter(
  item: ActivityNotificationItem,
  filter: CallLogInboxFilter
): boolean {
  if (filter === "all") return true;
  if (!item.callLogSeen) return filter === "not_seen";
  if (filter === "no_agent") return item.callLogSeen.kind === "no_agent";
  if (filter === "not_seen") return item.callLogSeen.kind === "not_seen";
  return true;
}

export function CallLogInboxList({
  items,
  pending,
  viewerRole,
  onItemClick,
}: {
  items: ActivityNotificationItem[];
  pending: boolean;
  viewerRole: string;
  onItemClick: (item: ActivityNotificationItem) => void;
}) {
  const t = useTranslations("activityNotifications.callLogFilters");
  const [filter, setFilter] = useState<CallLogInboxFilter>("all");

  const showFilters = roleShowsCallLogSeenStatus(viewerRole);

  const counts = useMemo(() => {
    let notSeen = 0;
    let noAgent = 0;
    for (const item of items) {
      if (item.callLogSeen?.kind === "not_seen") notSeen += 1;
      if (item.callLogSeen?.kind === "no_agent") noAgent += 1;
    }
    return { all: items.length, not_seen: notSeen, no_agent: noAgent };
  }, [items]);

  const filtered = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [items, filter]
  );

  const chips: Array<{ key: CallLogInboxFilter; count: number }> = [
    { key: "all", count: counts.all },
    { key: "not_seen", count: counts.not_seen },
    { key: "no_agent", count: counts.no_agent },
  ];

  return (
    <div className="space-y-3">
      {showFilters ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Button
              key={chip.key}
              type="button"
              size="sm"
              variant={filter === chip.key ? "default" : "outline"}
              className={cn("h-8 rounded-full px-3 text-xs")}
              onClick={() => setFilter(chip.key)}
            >
              {t(chip.key)}
              <span className="ms-1.5 tabular-nums text-[10px] opacity-80">
                {chip.count}
              </span>
            </Button>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("emptyFilter")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((item) => (
            <CallLogInboxRow
              key={item.id}
              item={item}
              pending={pending}
              viewerRole={viewerRole}
              onClick={() => onItemClick(item)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}