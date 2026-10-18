import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import { ActivityNotificationsFeed } from "@/components/notifications/activity-notifications-feed";
import {
  getMyActivityNotifications,
  getMyUnreadActivityNotificationCount,
} from "@/lib/actions/notifications";
import { canAccessRoute } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ActivityNotificationsPage() {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations("activityNotifications");

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  if (!canAccessRoute(session.user.role, "/notifications")) {
    redirect(`/${locale}/dashboard`);
  }

  const [listResult, unreadCount] = await Promise.all([
    getMyActivityNotifications(),
    getMyUnreadActivityNotificationCount(),
  ]);

  const items = listResult.success && listResult.items ? listResult.items : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ActivityNotificationsFeed
        initialItems={items}
        initialUnreadCount={unreadCount}
      />
    </div>
  );
}
