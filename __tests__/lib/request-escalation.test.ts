import { describe, expect, it, vi, beforeEach } from "vitest";

const notifyUserInboxTab = vi.fn();
const recordRequestAuditEvent = vi.fn();

vi.mock("@/lib/notifications/inbox-delivery", () => ({
  notifyUserInboxTab: (...args: unknown[]) => notifyUserInboxTab(...args),
  notifyRolesInboxTab: vi.fn(),
}));

vi.mock("@/lib/requests/audit", () => ({
  recordRequestAuditEvent: (...args: unknown[]) =>
    recordRequestAuditEvent(...args),
}));

vi.mock("@/lib/requests/late-request-watchers", () => ({
  resolveLateRequestWatcherUserIds: vi.fn().mockResolvedValue(["watcher-1"]),
}));

import { isRequestOverdue } from "@/lib/requests/overdue";
import { runRequestEscalationJob } from "@/lib/requests/escalation";

describe("request escalation", () => {
  beforeEach(() => {
    notifyUserInboxTab.mockReset();
    recordRequestAuditEvent.mockReset();
    notifyUserInboxTab.mockResolvedValue(true);
  });

  it("detects overdue pending requests", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    expect(
      isRequestOverdue({
        status: "PENDING",
        dueDate: new Date("2026-01-09T12:00:00Z"),
        now,
      })
    ).toBe(true);
    expect(
      isRequestOverdue({
        status: "APPROVED",
        dueDate: new Date("2026-01-09T12:00:00Z"),
        now,
      })
    ).toBe(false);
  });

  it("escalates without reassigning approver and sends watcher digest", async () => {
    const update = vi.fn();
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "req-1",
        type: "REFUND",
        status: "PENDING",
        dueDate: new Date("2020-01-01T00:00:00Z"),
        submittedAt: new Date("2020-01-01T00:00:00Z"),
        currentApproverKind: "FINANCE",
        escalatedToManagement: false,
        assignedApproverUserId: null,
        requestedById: "u1",
        requestedBy: { id: "u1", name: "Agent" },
        unitId: "unit-1",
        unitCycleStageKey: "FINANCE",
        unit: {
          id: "unit-1",
          unitCode: "A-1",
          agentId: "u1",
          project: { name: "Green Avenue" },
          client: { name: "Client" },
          unitClients: [{ role: "PRIMARY", client: { name: "Client" } }],
        },
      },
    ]);

    const findUnique = vi.fn().mockResolvedValue({ lastEscalatedAt: null });

    const prisma = {
      unitRequest: { findMany, findUnique, update },
      user: { findMany: vi.fn() },
      systemSetting: { findUnique: vi.fn() },
    };

    const result = await runRequestEscalationJob(prisma as never);
    expect(result.scanned).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "req-1" },
        data: {
          escalatedToManagement: true,
          lastEscalatedAt: expect.any(Date),
        },
      })
    );
    expect(update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentApproverKind: "MANAGEMENT" }),
      })
    );
    expect(notifyUserInboxTab).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "watcher-1",
        inboxTab: "REQUESTS_AND_FILES",
        dedupeKey: expect.stringMatching(/^late-request-digest:/),
      })
    );
    expect(recordRequestAuditEvent).toHaveBeenCalled();
  });
});