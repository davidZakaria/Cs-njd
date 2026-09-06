"use server";

import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { pickBilingualPair } from "@/lib/notifications/bilingual";
import { basePrisma } from "@/lib/prisma";

export type NotificationLogRow = {
  id: string;
  createdAt: string;
  recipientName: string;
  recipientRole: string;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  isRead: boolean;
  link: string | null;
  searchText: string;
};

export async function getNotificationLogRows(): Promise<NotificationLogRow[]> {
  await requireSuperAdmin();

  const rows = await basePrisma.notification.findMany({
    include: {
      user: {
        select: { name: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  return rows.map((row) => {
    const title = pickBilingualPair(row.title);
    const message = pickBilingualPair(row.message);

    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      recipientName: row.user.name,
      recipientRole: row.user.role,
      titleEn: title.en,
      titleAr: title.ar,
      messageEn: message.en,
      messageAr: message.ar,
      isRead: row.isRead,
      link: row.link,
      searchText: [
        row.user.name,
        row.user.role,
        title.en,
        title.ar,
        message.en,
        message.ar,
      ]
        .join(" ")
        .toLowerCase(),
    };
  });
}
