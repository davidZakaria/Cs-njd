"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import {
  getMyActivityNotifications,
  getMyUnreadActivityNotificationCount,
  markActivityNotificationAsRead,
  markAllActivityNotificationsAsRead,
  type ActivityNotificationItem,
} from "@/lib/actions/notifications";
import { formatDateTime } from "@/lib/format/datetime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

export function ActivityNotificationsFeed({
  initialItems,
  initialUnreadCount,
}: {
  initialItems: ActivityNotificationItem[];
  initialUnreadCount: number;
}) {
  const t = useTranslations("activityNotifications");
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const [listResult, count] = await Promise.all([
      getMyActivityNotifications(),
      getMyUnreadActivityNotificationCount(),
    ]);
    if (listResult.success && listResult.items) {
      setItems(listResult.items);
    }
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllActivityNotificationsAsRead();
      await refresh();
    });
  }

  function handleItemClick(item: ActivityNotificationItem) {
    startTransition(async () => {
      if (!item.isRead) {
        await markActivityNotificationAsRead(item.id);
      }
      if (item.link) {
        router.push(item.link);
      }
      await refresh();
    });
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        {unreadCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={handleMarkAllRead}
          >
            {t("markAllRead")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-4 py-3 text-start transition-colors hover:bg-muted/40",
                    !item.isRead && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "text-sm font-medium leading-snug",
                        !item.isRead && "font-semibold"
                      )}
                    >
                      {item.title}
                    </span>
                    <time
                      className="shrink-0 text-xs text-muted-foreground"
                      dateTime={item.createdAt}
                    >
                      {formatDateTime(item.createdAt, locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
