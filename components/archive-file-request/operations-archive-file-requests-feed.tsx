"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import {
  getOperationsArchiveFileInboxAction,
  getUnreadOperationsArchiveFileInboxCountAction,
  markOperationsArchiveFileRequestReadAction,
  type OperationsArchiveFileInboxItem,
} from "@/lib/actions/archive-file-request";
import { formatDateTime } from "@/lib/format/datetime";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

export function OperationsArchiveFileRequestsFeed({
  initialItems,
  initialUnreadCount,
}: {
  initialItems: OperationsArchiveFileInboxItem[];
  initialUnreadCount: number;
}) {
  const t = useTranslations("operationsArchiveFileRequests");
  const tEnums = useTranslations("enums");
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const [listResult, count] = await Promise.all([
      getOperationsArchiveFileInboxAction(),
      getUnreadOperationsArchiveFileInboxCountAction(),
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

  function openRequest(item: OperationsArchiveFileInboxItem) {
    startTransition(async () => {
      if (item.isUnread) {
        await markOperationsArchiveFileRequestReadAction({ requestId: item.id });
      }
      router.push(`/operations/requests/${item.id}`);
      await refresh();
    });
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        {unreadCount > 0 ? (
          <Badge variant="destructive">{t("unreadBadge", { count: unreadCount })}</Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => openRequest(item)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-4 py-3 text-start transition-colors hover:bg-muted/40",
                    item.isUnread && "bg-primary/5"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          item.isUnread && "font-semibold"
                        )}
                      >
                        {item.projectName} · {item.unitCode}
                      </span>
                      {item.priority === "URGENT" ? (
                        <Badge variant="destructive">{t("urgent")}</Badge>
                      ) : null}
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(item.submittedAt ?? item.createdAt, locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("requestedBy", { name: item.requestedByName })}
                    {" · "}
                    {item.fileKinds
                      .map((k) => tEnums(`archiveFileKind.${k}`))
                      .join(", ")}
                    {item.pendingCount > 0
                      ? ` · ${t("pendingFiles", { count: item.pendingCount })}`
                      : ""}
                  </p>
                  {item.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
