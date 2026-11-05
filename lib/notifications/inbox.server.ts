import "server-only";

import type { NotificationInboxTab, Role } from "@prisma/client";

import { encodeBilingual } from "@/lib/notifications/bilingual";
import { basePrisma } from "@/lib/prisma";

export type { InboxTabKey } from "@/lib/notifications/inbox-types";
export {
  INBOX_TAB_TO_ENUM,
  inboxTabFromParam,
  inboxTabQueryParam,
} from "@/lib/notifications/inbox-types";

export async function notifyRolesInboxTab(input: {
  roles: Role[];
  inboxTab: NotificationInboxTab;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  link?: string;
  dedupeKey?: string;
}): Promise<number> {
  if (input.roles.length === 0) return 0;

  const users = await basePrisma.user.findMany({
    where: { role: { in: input.roles }, deletedAt: null },
    select: { id: true },
  });
  if (users.length === 0) return 0;

  const data = users.map((user) => ({
    userId: user.id,
    kind: "ACTIVITY" as const,
    inboxTab: input.inboxTab,
    dedupeKey: input.dedupeKey ?? null,
    title: encodeBilingual(input.titleEn, input.titleAr),
    message: encodeBilingual(input.messageEn, input.messageAr),
    link: input.link ?? null,
  }));

  if (input.dedupeKey) {
    let created = 0;
    for (const row of data) {
      try {
        await basePrisma.notification.create({ data: row });
        created += 1;
      } catch {
        // Unique (userId, dedupeKey) — digest already sent.
      }
    }
    return created;
  }

  const result = await basePrisma.notification.createMany({ data });
  return result.count;
}

export async function notifyUserInboxTab(input: {
  userId: string;
  inboxTab: NotificationInboxTab;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  link?: string;
  dedupeKey?: string;
}): Promise<boolean> {
  if (!input.userId) return false;

  const user = await basePrisma.user.findFirst({
    where: { id: input.userId, deletedAt: null },
    select: { id: true },
  });
  if (!user) return false;

  const data = {
    userId: input.userId,
    kind: "ACTIVITY" as const,
    inboxTab: input.inboxTab,
    dedupeKey: input.dedupeKey ?? null,
    title: encodeBilingual(input.titleEn, input.titleAr),
    message: encodeBilingual(input.messageEn, input.messageAr),
    link: input.link ?? null,
  };

  if (input.dedupeKey) {
    try {
      await basePrisma.notification.create({ data });
      return true;
    } catch {
      return false;
    }
  }

  await basePrisma.notification.create({ data });
  return true;
}
