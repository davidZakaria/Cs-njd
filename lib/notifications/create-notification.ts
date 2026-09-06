import { encodeBilingual } from "@/lib/notifications/bilingual";
import { basePrisma } from "@/lib/prisma";

export type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  link?: string;
};

export async function createNotification(input: CreateNotificationInput) {
  const title =
    input.title.startsWith("{") ? input.title : encodeBilingual(input.title, input.title);
  const message =
    input.message.startsWith("{")
      ? input.message
      : encodeBilingual(input.message, input.message);

  return basePrisma.notification.create({
    data: {
      userId: input.userId,
      title,
      message,
      link: input.link ?? null,
    },
  });
}

export async function createNotifications(inputs: CreateNotificationInput[]) {
  if (inputs.length === 0) return { count: 0 };

  return basePrisma.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      title: input.title.startsWith("{")
        ? input.title
        : encodeBilingual(input.title, input.title),
      message: input.message.startsWith("{")
        ? input.message
        : encodeBilingual(input.message, input.message),
      link: input.link ?? null,
    })),
  });
}

export async function getManagementRecipientIds() {
  const users = await basePrisma.user.findMany({
    where: {
      role: { in: ["MANAGEMENT", "SUPER_ADMIN"] },
      deletedAt: null,
    },
    select: { id: true },
  });

  return users.map((user) => user.id);
}
