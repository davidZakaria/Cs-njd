"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import {
  getMyNotifications,
  getMyUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationItem,
} from "@/lib/actions/notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatRelativeTime(iso: string, locale: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return locale === "ar" ? "الآن" : "Just now";
  if (diffMinutes < 60) {
    return locale === "ar" ? `منذ ${diffMinutes} د` : `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return locale === "ar" ? `منذ ${diffHours} س` : `${diffHours}h ago`;
  }

  return date.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function NotificationBell({ locale }: { locale: string }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    const [listResult, count] = await Promise.all([
      getMyNotifications(),
      getMyUnreadNotificationCount(),
    ]);

    if (listResult.success && listResult.items) {
      setItems(listResult.items);
    }
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsAsRead();
      await refresh();
    });
  }

  function handleNotificationClick(item: NotificationItem) {
    startTransition(async () => {
      if (!item.isRead) {
        await markNotificationAsRead(item.id);
      }
      setOpen(false);
      if (item.link) {
        router.push(item.link);
      }
      await refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative"
        )}
        aria-label={t("bellLabel")}
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <Badge
            variant="destructive"
            className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-80 p-0">
        <PopoverHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5">
          <PopoverTitle className="font-heading text-sm">
            {t("title")}
          </PopoverTitle>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-7 text-xs"
              disabled={pending}
              onClick={handleMarkAllRead}
            >
              {t("markAllRead")}
            </Button>
          ) : null}
        </PopoverHeader>

        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleNotificationClick(item)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 px-3 py-2.5 text-start transition-colors hover:bg-muted/50",
                      !item.isRead && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "text-sm leading-snug",
                          !item.isRead && "font-semibold"
                        )}
                      >
                        {item.title}
                      </span>
                      {!item.isRead ? (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {item.message}
                    </p>
                    <span className="text-[10px] text-muted-foreground/80">
                      {formatRelativeTime(item.createdAt, locale)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
