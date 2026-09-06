"use server";

import { auth } from "@/lib/auth";
import { pickBilingual } from "@/lib/notifications/bilingual";
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

export async function getMyNotifications(): Promise<
  ActionResult & { items?: NotificationItem[] }
> {
  const session = await auth();
  if (!session?.user?.id) return actionFail("Unauthorized");

  const locale = await getLocale();

  const items = await basePrisma.notification.findMany({
    where: { userId: session.user.id },
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

  return {
    success: true,
    items: items.map((item) => ({
      id: item.id,
      title: pickBilingual(item.title, locale),
      message: pickBilingual(item.message, locale),
      isRead: item.isRead,
      link: item.link,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function getMyUnreadNotificationCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  return basePrisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  });
}

export async function markNotificationAsRead(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return actionFail("Unauthorized");

  const notification = await basePrisma.notification.findFirst({
    where: { id, userId: session.user.id },
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
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/", "layout");
  return actionOk();
}
