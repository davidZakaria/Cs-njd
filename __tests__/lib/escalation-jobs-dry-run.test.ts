import { beforeEach, describe, expect, it, vi } from "vitest";

const notifyUserInboxTab = vi.fn();
const notifyRolesInboxTab = vi.fn();
const recordRequestAuditEvent = vi.fn();
const recordUnitCycleAuditEvent = vi.fn();
const getOverdueStagesForManagement = vi.fn();

vi.mock("@/lib/notifications/inbox-delivery", () => ({
  notifyUserInboxTab: (...args: unknown[]) => notifyUserInboxTab(...args),
  notifyRolesInboxTab: (...args: unknown[]) => notifyRolesInboxTab(...args),
}));

vi.mock("@/lib/requests/audit", () => ({
  recordRequestAuditEvent: (...args: unknown[]) =>
    recordRequestAuditEvent(...args),
}));

vi.mock("@/lib/unit-cycle/audit", () => ({
  recordUnitCycleAuditEvent: (...args: unknown[]) =>
    recordUnitCycleAuditEvent(...args),
}));

vi.mock("@/lib/requests/late-request-watchers", () => ({
  resolveLateRequestWatcherUserIds: vi.fn().mockResolvedValue(["watcher-mgmt"]),
}));

vi.mock("@/lib/unit-cycle/queries", () => ({
  getOverdueStagesForManagement: (...args: unknown[]) =>
    getOverdueStagesForManagement(...args),
}));

import { runArchiveCheckGapEscalationJob } from "@/lib/archive-check/escalation";
import { runRequestEscalationJob } from "@/lib/requests/escalation";
import { runUnitCycleEscalationJob } from "@/lib/unit-cycle/escalation";

describe("escalation jobs dry run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyUserInboxTab.mockResolvedValue(true);
    notifyRolesInboxTab.mockResolvedValue(1);
    getOverdueStagesForManagement.mockResolvedValue([
      {
        unitCycleId: "cycle-1",
        unitId: "unit-1",
        unitCode: "GA-101",
        projectId: "proj-1",
        projectName: "Green Avenue",
        stageKey: "CONTRACT",
        daysOverdue: 3,
        assigneeUserId: "owner-1",
        ownerUserId: "owner-1",
        ownerRole: "LEGAL",
      },
      {
        unitCycleId: "cycle-2",
        unitId: "unit-2",
        unitCode: "GA-202",
        projectId: "proj-1",
        projectName: "Green Avenue",
        stageKey: "FINANCE",
        daysOverdue: 2,
        assigneeUserId: null,
        ownerUserId: null,
        ownerRole: "FINANCE",
      },
    ]);
  });

  it("request escalation dry run performs zero writes and zero notifications", async () => {
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
        assignedApproverUserId: "approver-1",
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
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ role: "FINANCE" }),
      },
      systemSetting: { findUnique: vi.fn() },
    };

    const result = await runRequestEscalationJob(prisma as never, { dryRun: true });

    expect(result.notified).toBe(0);
    expect(result.preview?.wouldEscalateRequestIds).toEqual(["req-1"]);
    expect(result.preview?.approverNotifications).toEqual([
      { userId: "approver-1", requestId: "req-1", unitCode: "A-1" },
    ]);
    expect(result.preview?.watcherDigestUserIds).toEqual(["watcher-mgmt"]);
    expect(update).not.toHaveBeenCalled();
    expect(notifyUserInboxTab).not.toHaveBeenCalled();
    expect(recordRequestAuditEvent).not.toHaveBeenCalled();
  });

  it("unit cycle escalation dry run performs zero writes and zero notifications", async () => {
    const stageUpdate = vi.fn();
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ role: "LEGAL" }),
        findMany: vi.fn().mockResolvedValue([{ id: "mgmt-1" }]),
      },
      unitCycleStage: {
        findFirst: vi.fn().mockResolvedValue({ id: "stage-1" }),
        update: stageUpdate,
      },
    };

    const result = await runUnitCycleEscalationJob(prisma as never, { dryRun: true });

    expect(result.notified).toBe(0);
    expect(result.preview?.managementDigests.length).toBeGreaterThan(0);
    expect(result.preview?.ownerDigests[0]?.userId).toBe("owner-1");
    expect(result.preview?.departmentPoolDigests[0]?.department).toBe("FINANCE");
    expect(stageUpdate).not.toHaveBeenCalled();
    expect(notifyUserInboxTab).not.toHaveBeenCalled();
    expect(notifyRolesInboxTab).not.toHaveBeenCalled();
    expect(recordUnitCycleAuditEvent).not.toHaveBeenCalled();
  });

  it("archive gap escalation dry run performs zero writes and zero notifications", async () => {
    const gapUpdate = vi.fn();
    const requestUpdate = vi.fn();
    const prisma = {
      archiveCheckGapTask: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "gap-1",
            status: "OPEN",
            itemKey: "national_id",
            deadlineAt: new Date("2020-01-01"),
            lastEscalatedAt: null,
            ownerUserId: "legal-1",
            unitRequestId: "req-arch",
            unitRequest: {
              unit: {
                id: "unit-1",
                unitCode: "B-2",
                project: { name: "Demo" },
              },
            },
          },
        ]),
        update: gapUpdate,
      },
      unitRequest: { update: requestUpdate },
      user: { findMany: vi.fn().mockResolvedValue([{ id: "mgmt-1" }]) },
    };

    const result = await runArchiveCheckGapEscalationJob(prisma as never, {
      dryRun: true,
    });

    expect(result.notified).toBe(0);
    expect(result.preview?.wouldEscalateGaps).toEqual([
      expect.objectContaining({
        gapTaskId: "gap-1",
        requestId: "req-arch",
        unitCode: "B-2",
        itemKey: "national_id",
        recipientUserIds: ["mgmt-1"],
      }),
    ]);
    expect(gapUpdate).not.toHaveBeenCalled();
    expect(requestUpdate).not.toHaveBeenCalled();
    expect(notifyRolesInboxTab).not.toHaveBeenCalled();
    expect(recordRequestAuditEvent).not.toHaveBeenCalled();
  });
});