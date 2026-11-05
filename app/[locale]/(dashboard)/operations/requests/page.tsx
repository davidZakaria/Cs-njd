import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { canAccessOperationsArchiveFileInbox } from "@/lib/archive-file-request/permissions";
import {
  getOperationsArchiveFileInboxAction,
  getUnreadOperationsArchiveFileInboxCountAction,
} from "@/lib/actions/archive-file-request";
import { OperationsArchiveFileRequestsFeed } from "@/components/archive-file-request/operations-archive-file-requests-feed";
import { getTranslations } from "next-intl/server";

export default async function OperationsArchiveFileRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user || !canAccessOperationsArchiveFileInbox(session.user.role)) {
    redirect({ href: "/", locale });
  }

  const t = await getTranslations("operationsArchiveFileRequests");
  const [listResult, unreadCount] = await Promise.all([
    getOperationsArchiveFileInboxAction(),
    getUnreadOperationsArchiveFileInboxCountAction(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageSubtitle")}</p>
      </div>
      <OperationsArchiveFileRequestsFeed
        initialItems={listResult.success && listResult.items ? listResult.items : []}
        initialUnreadCount={unreadCount}
      />
    </div>
  );
}
