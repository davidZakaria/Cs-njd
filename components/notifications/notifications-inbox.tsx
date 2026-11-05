"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import {
  getMyActivityNotifications,
  getMyInboxUnreadCounts,
  markActivityNotificationAsRead,
  markAllActivityNotificationsAsRead,
  type ActivityNotificationItem,
  type InboxUnreadCounts,
} from "@/lib/actions/notifications";
import {
  inboxTabQueryParam,
  type InboxTabKey,
} from "@/lib/notifications/inbox-types";
import { formatDateTime } from "@/lib/format/datetime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

const TAB_KEYS: InboxTabKey[] = ["callLogs", "requestsAndFiles", "overdueTasks"];

function TabCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ms-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive/90 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-destructive-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function NotificationsInbox({
  initialTab,
  initialItemsByTab,
  initialUnreadCounts,
}: {
  initialTab: InboxTabKey;
  initialItemsByTab: Record<InboxTabKey, ActivityNotificationItem[]>;
  initialUnreadCounts: InboxUnreadCounts;
}) {
  const t = useTranslations("activityNotifications");
  const locale = useLocale();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<InboxTabKey>(initialTab);
  const [itemsByTab, setItemsByTab] = useState(initialItemsByTab);
  const [unreadCounts, setUnreadCounts] = useState(initialUnreadCounts);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const [callLogs, requestsAndFiles, overdueTasks, counts] = await Promise.all([
      getMyActivityNotifications("callLogs"),
      getMyActivityNotifications("requestsAndFiles"),
      getMyActivityNotifications("overdueTasks"),
      getMyInboxUnreadCounts(),
    ]);

    setItemsByTab({
      callLogs: callLogs.success && callLogs.items ? callLogs.items : [],
      requestsAndFiles:
        requestsAndFiles.success && requestsAndFiles.items
          ? requestsAndFiles.items
          : [],
      overdueTasks:
        overdueTasks.success && overdueTasks.items ? overdueTasks.items : [],
    });
    setUnreadCounts(counts);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  function switchTab(tab: InboxTabKey) {
    setActiveTab(tab);
    router.replace(`/notifications?tab=${inboxTabQueryParam(tab)}`);
  }

  function handleMarkAllRead(tab: InboxTabKey) {
    startTransition(async () => {
      await markAllActivityNotificationsAsRead(tab);
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

  function renderList(tab: InboxTabKey) {
    const items = itemsByTab[tab];
    const emptyKey =
      tab === "callLogs"
        ? "emptyCallLogs"
        : tab === "requestsAndFiles"
          ? "emptyRequestsAndFiles"
          : "emptyOverdueTasks";

    if (items.length === 0) {
      return (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t(emptyKey)}
        </p>
      );
    }

    return (
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
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-xl">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(value) => switchTab(value as InboxTabKey)}
        >
          <TabsList className="mb-4 h-auto w-full flex-wrap justify-start gap-1">
            {TAB_KEYS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-xs sm:text-sm">
                {t(`tabs.${tab}`)}
                <TabCountBadge
                  count={
                    tab === "callLogs"
                      ? unreadCounts.callLogs
                      : tab === "requestsAndFiles"
                        ? unreadCounts.requestsAndFiles
                        : unreadCounts.overdueTasks
                  }
                />
              </TabsTrigger>
            ))}
          </TabsList>

          {TAB_KEYS.map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-3">
              {(tab === "callLogs"
                ? unreadCounts.callLogs
                : tab === "requestsAndFiles"
                  ? unreadCounts.requestsAndFiles
                  : unreadCounts.overdueTasks) > 0 ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => handleMarkAllRead(tab)}
                  >
                    {t("markAllRead")}
                  </Button>
                </div>
              ) : null}
              {renderList(tab)}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
