import { beforeEach, describe, expect, it, vi } from "vitest";

const notifyUserInboxTab = vi.fn();

vi.mock("@/lib/notifications/inbox-delivery", () => ({
  notifyUserInboxTab: (...args: unknown[]) => notifyUserInboxTab(...args),
}));

vi.mock("@/lib/requests/audit", () => ({
  recordRequestAuditEvent: vi.fn(),
}));

vi.mock("@/lib/requests/late-request-watchers", () => ({
  resolveLateRequestWatcherUserIds: vi.fn().mockResolvedValue([]),
}));

import { runRequestEscalationJob } from "@/lib/requests/escalation";

describe("request escalation viewer links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyUserInboxTab.mockResolvedValue(true);
  });

  it("notifies Operations with operations archive file link", async () => {
    const overdue = new Date("2020-01-01T00:00:00Z");
    const prisma = {
      unitRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "req-archive-file",
            type: "ARCHIVE_FILE_REQUEST",
            status: "PENDING",
            dueDate: overdue,
            submittedAt: overdue,
            currentApproverKind: "OPERATIONS",
            escalatedToManagement: false,
            assignedApproverUserId: "ops-user",
            requestedById: "cs-1",
            unitCycleStageKey: null,
            requestedBy: { id: "cs-1", name: "CS" },
            unit: {
              id: "unit-1",
              unitCode: "DEMO-1",
              agentId: "cs-1",
              project: { name: "Jura" },
              client: { name: "Client" },
              unitClients: [],
            },
          },
        ]),
        findUnique: vi.fn().mockResolvedValue({ lastEscalatedAt: null }),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ role: "OPERATIONS" }),
      },
      systemSetting: { findUnique: vi.fn() },
    };

    await runRequestEscalationJob(prisma as never);

    expect(notifyUserInboxTab).toHaveBeenCalledWith(
      expect.objectContaining({
        link: "/operations/requests/req-archive-file",
      })
    );
  });
});