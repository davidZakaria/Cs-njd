import { getTranslations } from "next-intl/server";

import {
  createNotification,
  createNotifications,
  getManagementRecipientIds,
} from "@/lib/notifications/create-notification";

export async function notifyCaseAssigned({
  agentUserId,
  unitCode,
  unitId,
}: {
  agentUserId: string;
  unitCode: string;
  unitId: string;
}) {
  const t = await getTranslations("notifications.messages");

  await createNotification({
    userId: agentUserId,
    title: t("caseAssignedTitle"),
    message: t("caseAssignedMessage", { unitCode }),
    link: `/units/${unitId}`,
  });
}

export async function notifyCaseStatusUpdated({
  unitCode,
  unitId,
  status,
  agentName,
}: {
  unitCode: string;
  unitId: string;
  status: "LEGAL" | "RESOLVED";
  agentName: string;
}) {
  const t = await getTranslations("notifications.messages");
  const tStatus = await getTranslations("enums.ticketStatus");

  const statusLabel = tStatus(status);
  const recipientIds = await getManagementRecipientIds();

  if (recipientIds.length === 0) return;

  await createNotifications(
    recipientIds.map((userId) => ({
      userId,
      title: t("caseStatusUpdatedTitle"),
      message: t("caseStatusUpdatedMessage", {
        unitCode,
        status: statusLabel,
        agentName,
      }),
      link: `/cases`,
    }))
  );
}
