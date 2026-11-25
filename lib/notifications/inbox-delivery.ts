import type { NotificationInboxTab, Role } from "@prisma/client";

import { encodeBilingual } from "@/lib/notifications/bilingual";
import { basePrisma } from "@/lib/prisma";

const activeUserWhere = { deletedAt: null, isActive: true } as const;

/** Node/cron-safe inbox delivery (no `server-only`). Web app should import via `inbox.server.ts`. */
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
    where: { role: { in: input.roles }, ...activeUserWhere },
    select: { id: true },
  });
  if (users.length === 0) return 0;

  const seen = new Set<string>();
  const data = users
    .filter((user) => {
      if (seen.has(user.id)) return false;
      seen.add(user.id);
      return true;
    })
    .map((user) => ({
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
    where: { id: input.userId, ...activeUserWhere },
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