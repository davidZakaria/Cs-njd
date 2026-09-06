import type { Role } from "@prisma/client";

import { encodeBilingual } from "@/lib/notifications/bilingual";
import { basePrisma } from "@/lib/prisma";

export async function notifyUser(
  userId: string,
  titleEn: string,
  titleAr: string,
  messageEn: string,
  messageAr: string,
  link?: string
): Promise<void> {
  if (!userId) return;

  const user = await basePrisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true },
  });
  if (!user) return;

  await basePrisma.notification.create({
    data: {
      userId,
      title: encodeBilingual(titleEn, titleAr),
      message: encodeBilingual(messageEn, messageAr),
      link: link ?? null,
    },
  });
}

export async function notifyRoles(
  roles: Role[],
  titleEn: string,
  titleAr: string,
  messageEn: string,
  messageAr: string,
  link?: string
): Promise<void> {
  if (roles.length === 0) return;

  const users = await basePrisma.user.findMany({
    where: {
      role: { in: roles },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (users.length === 0) return;

  await basePrisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      title: encodeBilingual(titleEn, titleAr),
      message: encodeBilingual(messageEn, messageAr),
      link: link ?? null,
    })),
  });
}

export async function getActiveEngineerUserId(): Promise<string | null> {
  const engineer = await basePrisma.user.findFirst({
    where: { role: "ENGINEER", deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return engineer?.id ?? null;
}
