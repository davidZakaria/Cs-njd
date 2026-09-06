import { getTranslations } from "next-intl/server";

import { NotificationsLogTable } from "@/components/system/notifications-log-table";
import { getNotificationLogRows } from "@/lib/actions/notification-log";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

export const dynamic = "force-dynamic";

export default async function NotificationsLogPage() {
  await requireSuperAdmin();
  const t = await getTranslations("notificationsLog");
  const rows = await getNotificationLogRows();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <NotificationsLogTable rows={rows} />
    </div>
  );
}
