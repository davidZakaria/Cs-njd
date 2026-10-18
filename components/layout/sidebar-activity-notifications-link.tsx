"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

import { getMyUnreadActivityNotificationCount } from "@/lib/actions/notifications";
import { Badge } from "@/components/ui/badge";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

export function SidebarActivityNotificationsLink() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const href = "/notifications";
  const active =
    pathname === href || pathname.startsWith(`${href}/`);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const count = await getMyUnreadActivityNotificationCount();
      if (!cancelled) setUnreadCount(count);
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pathname]);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        className={cn(
          "rounded-lg [dir=rtl]:flex-row-reverse",
          active && "bg-primary/10"
        )}
        render={<Link href={href} />}
      >
        <Bell className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{t("activityNotifications")}</span>
        {unreadCount > 0 ? (
          <Badge
            variant="destructive"
            className="ms-auto h-5 min-w-5 justify-center px-1 text-[10px]"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
