import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import { NotificationsInbox } from "@/components/notifications/notifications-inbox";
import {
  getMyActivityNotifications,
  getMyInboxUnreadCounts,
} from "@/lib/actions/notifications";
import { canAccessRoute } from "@/lib/rbac";
import {
  inboxTabFromParam,
  type InboxTabKey,
} from "@/lib/notifications/inbox-types";

export const dynamic = "force-dynamic";

export default async function ActivityNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations("activityNotifications");
  const { tab: tabParam } = await searchParams;
  const initialTab = inboxTabFromParam(tabParam);

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  if (!canAccessRoute(session.user.role, "/notifications")) {
    redirect(`/${locale}/dashboard`);
  }

  const tabs: InboxTabKey[] = ["callLogs", "requestsAndFiles", "overdueTasks"];

  const [callLogs, requestsAndFiles, overdueTasks, unreadCounts] =
    await Promise.all([
      getMyActivityNotifications("callLogs"),
      getMyActivityNotifications("requestsAndFiles"),
      getMyActivityNotifications("overdueTasks"),
      getMyInboxUnreadCounts(),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <NotificationsInbox
        initialTab={initialTab}
        initialItemsByTab={{
          callLogs: callLogs.success && callLogs.items ? callLogs.items : [],
          requestsAndFiles:
            requestsAndFiles.success && requestsAndFiles.items
              ? requestsAndFiles.items
              : [],
          overdueTasks:
            overdueTasks.success && overdueTasks.items ? overdueTasks.items : [],
        }}
        initialUnreadCounts={unreadCounts}
      />
    </div>
  );
}
