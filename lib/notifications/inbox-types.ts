import type { NotificationInboxTab } from "@prisma/client";

export type InboxTabKey = "callLogs" | "requestsAndFiles" | "overdueTasks";

export const INBOX_TAB_TO_ENUM: Record<InboxTabKey, NotificationInboxTab> = {
  callLogs: "CALL_LOG",
  requestsAndFiles: "REQUESTS_AND_FILES",
  overdueTasks: "OVERDUE_TASKS",
};

export function inboxTabFromParam(param: string | undefined): InboxTabKey {
  if (param === "requests" || param === "requestsAndFiles") {
    return "requestsAndFiles";
  }
  if (param === "overdue" || param === "overdueTasks") {
    return "overdueTasks";
  }
  return "callLogs";
}

export function inboxTabQueryParam(tab: InboxTabKey): string {
  if (tab === "requestsAndFiles") return "requests";
  if (tab === "overdueTasks") return "overdue";
  return "calls";
}
