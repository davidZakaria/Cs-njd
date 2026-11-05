"use server";

import { auth } from "@/lib/auth";
import { pickBilingual } from "@/lib/notifications/bilingual";
import {
  INBOX_TAB_TO_ENUM,
  type InboxTabKey,
} from "@/lib/notifications/inbox-types";
import { basePrisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { actionFail, actionOk, type ActionResult } from "@/lib/actions/result";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
};

export type ActivityNotificationItem = NotificationItem;

export type InboxUnreadCounts = {
  callLogs: number;
  requestsAndFiles: number;
  overdueTasks: number;
  total: number;
};

function mapNotificationRows(
  items: Array<{
    id: string;
    title: string;
    message: string;
    isRead: boolean;
    link: string | null;
    createdAt: Date;
  }>,
  locale: string
): NotificationItem[] {
  return items.map((item) => ({
    id: item.id,
    title: pickBilingual(item.title, locale),
    message: pickBilingual(item.message, locale),
    isRead: item.isRead,
    link: item.link,
    createdAt: item.createdAt.toISOString(),
  }));
}

function inboxWhereForTab(userId: string, tab: InboxTabKey) {
  if (tab === "callLogs") {
    return {
      userId,
      kind: "ACTIVITY" as const,
      inboxTab: INBOX_TAB_TO_ENUM.callLogs,
    };
  }
  if (tab === "requestsAndFiles") {
    return {
      userId,
      OR: [
        {
          kind: "ACTIVITY" as const,
          inboxTab: INBOX_TAB_TO_ENUM.requestsAndFiles,
        },
        { kind: "GENERAL" as const, inboxTab: null },
      ],
    };
  }
  return {
    userId,
    kind: "ACTIVITY" as const,
    inboxTab: INBOX_TAB_TO_ENUM.overdueTasks,
  };
}

export async function getMyNotifications(): Promise<
  ActionResult & { items?: NotificationItem[] }
> {
  const session = await auth();
  if (!session?.user?.id) return actionFail("Unauthorized");

  const locale = await getLocale();

  const items = await basePrisma.notification.findMany({
    where: { userId: session.user.id, kind: "GENERAL" },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      message: true,
      isRead: true,
      link: true,
      createdAt: true,
    },
  });

  return { success: true, items: mapNotificationRows(items, locale) };
}

export async function getMyUnreadNotificationCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  return basePrisma.notification.count({
    where: { userId: session.user.id, isRead: false, kind: "GENERAL" },
  });
}

export async function getMyActivityNotifications(
  tab: InboxTabKey = "callLogs"
): Promise<ActionResult & { items?: ActivityNotificationItem[] }> {
  const session = await auth();
  if (!session?.user?.id) return actionFail("Unauthorized");

  const locale = await getLocale();

  const items = await basePrisma.notification.findMany({
    where: inboxWhereForTab(session.user.id, tab),
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      title: true,
      message: true,
      isRead: true,
      link: true,
      createdAt: true,
    },
  });

  return { success: true, items: mapNotificationRows(items, locale) };
}

export async function getMyUnreadActivityNotificationCount(
  tab?: InboxTabKey
): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  if (tab) {
    return basePrisma.notification.count({
      where: { ...inboxWhereForTab(session.user.id, tab), isRead: false },
    });
  }

  const counts = await getMyInboxUnreadCounts();
  return counts.total;
}

export async function getMyInboxUnreadCounts(): Promise<InboxUnreadCounts> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      callLogs: 0,
      requestsAndFiles: 0,
      overdueTasks: 0,
      total: 0,
    };
  }

  const userId = session.user.id;
  const [callLogs, requestsAndFiles, overdueTasks] = await Promise.all([
    basePrisma.notification.count({
      where: { ...inboxWhereForTab(userId, "callLogs"), isRead: false },
    }),
    basePrisma.notification.count({
      where: { ...inboxWhereForTab(userId, "requestsAndFiles"), isRead: false },
    }),
    basePrisma.notification.count({
      where: { ...inboxWhereForTab(userId, "overdueTasks"), isRead: false },
    }),
  ]);

  return {
    callLogs,
    requestsAndFiles,
    overdueTasks,
    total: callLogs + requestsAndFiles + overdueTasks,
  };
}

function markReadWhereForTab(userId: string, tab?: InboxTabKey) {
  if (!tab) {
    return {
      userId,
      isRead: false,
      OR: [
        { kind: "ACTIVITY" as const, inboxTab: INBOX_TAB_TO_ENUM.callLogs },
        { kind: "ACTIVITY" as const, inboxTab: INBOX_TAB_TO_ENUM.requestsAndFiles },
        { kind: "GENERAL" as const, inboxTab: null },
        { kind: "ACTIVITY" as const, inboxTab: INBOX_TAB_TO_ENUM.overdueTasks },
      ],
    };
  }
  return { ...inboxWhereForTab(userId, tab), isRead: false };
}

export async function markActivityNotificationAsRead(
  id: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return actionFail("Unauthorized");

  const notification = await basePrisma.notification.findFirst({
    where: {
      id,
      userId: session.user.id,
      OR: [
        { kind: "ACTIVITY" },
        { kind: "GENERAL", inboxTab: null },
      ],
    },
  });

  if (!notification) return actionFail("Notification not found");

  if (!notification.isRead) {
    await basePrisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  revalidatePath("/notifications");
  return actionOk();
}

export async function markAllActivityNotificationsAsRead(
  tab?: InboxTabKey
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return actionFail("Unauthorized");

  await basePrisma.notification.updateMany({
    where: markReadWhereForTab(session.user.id, tab),
    data: { isRead: true },
  });

  revalidatePath("/notifications");
  return actionOk();
}

export async function markNotificationAsRead(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return actionFail("Unauthorized");

  const notification = await basePrisma.notification.findFirst({
    where: { id, userId: session.user.id, kind: "GENERAL" },
  });

  if (!notification) return actionFail("Notification not found");

  if (!notification.isRead) {
    await basePrisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  return actionOk();
}

export async function markAllNotificationsAsRead(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return actionFail("Unauthorized");

  await basePrisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false, kind: "GENERAL" },
    data: { isRead: true },
  });

  revalidatePath("/", "layout");
  return actionOk();
}
