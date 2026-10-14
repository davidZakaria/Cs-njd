import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { NotificationLogRow } from "@/lib/actions/notification-log";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => {
    const t = (key: string) => key;
    return t;
  },
}));

const sampleRow: NotificationLogRow = {
  id: "notif-1",
  createdAt: "2026-09-30T12:00:00.000Z",
  recipientName: "Test Agent",
  recipientRole: "CS_AGENT",
  titleEn: "Call logged",
  titleAr: "تم تسجيل مكالمة",
  messageEn: "A call was logged for unit A-101.",
  messageAr: "تم تسجيل مكالمة للوحدة A-101.",
  isRead: false,
  link: "/units/unit-1",
  searchText: "test agent call logged",
};

describe("NotificationsLogTable", () => {
  it("renders a row without Intl format errors", async () => {
    const { NotificationsLogTable } = await import(
      "@/components/system/notifications-log-table"
    );

    const html = renderToString(
      React.createElement(NotificationsLogTable, { rows: [sampleRow] })
    );

    expect(html).toContain("Test Agent");
    expect(html).toContain("Call logged");
    expect(html).not.toContain("Invalid option");
  });
});
