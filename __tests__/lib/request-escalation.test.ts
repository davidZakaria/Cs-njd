import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const notifyRoles = vi.fn();
const recordRequestAuditEvent = vi.fn();

vi.mock("@/lib/services/notifications", () => ({
  notifyRoles: (...args: unknown[]) => notifyRoles(...args),
}));

vi.mock("@/lib/requests/audit", () => ({
  recordRequestAuditEvent: (...args: unknown[]) =>
    recordRequestAuditEvent(...args),
}));

import { isRequestOverdue } from "@/lib/requests/overdue";
import { runRequestEscalationJob } from "@/lib/requests/escalation";

describe("request escalation", () => {
  beforeEach(() => {
    notifyRoles.mockClear();
    recordRequestAuditEvent.mockClear();
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

  it("escalates overdue rows to management approver", async () => {
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
        },
      },
    ]);

    const findUnique = vi.fn().mockResolvedValue({ lastEscalatedAt: null });

    const prisma = {
      unitRequest: { findMany, findUnique, update },
    };

    const result = await runRequestEscalationJob(prisma as never);
    expect(result.scanned).toBe(1);
    expect(result.notified).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "req-1" },
        data: expect.objectContaining({
          escalatedToManagement: true,
          currentApproverKind: "MANAGEMENT",
        }),
      })
    );
    expect(notifyRoles).toHaveBeenCalled();
    expect(recordRequestAuditEvent).toHaveBeenCalled();
  });
});
