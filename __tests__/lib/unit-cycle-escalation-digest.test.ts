import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockUserFindMany = vi.fn();
const mockNotificationCreate = vi.fn();
const mockNotificationCreateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  basePrisma: {
    user: { findMany: (...args: unknown[]) => mockUserFindMany(...args) },
    notification: {
      create: (...args: unknown[]) => mockNotificationCreate(...args),
      createMany: (...args: unknown[]) => mockNotificationCreateMany(...args),
    },
  },
}));

describe("notifyRolesInboxTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindMany.mockResolvedValue([{ id: "mgmt-1" }]);
    mockNotificationCreate.mockResolvedValue({ id: "n1" });
  });

  it("creates digest notifications with dedupe and inbox tab", async () => {
    const { notifyRolesInboxTab } = await import("@/lib/notifications/inbox.server");

    const count = await notifyRolesInboxTab({
      roles: ["MANAGEMENT"],
      inboxTab: "OVERDUE_TASKS",
      titleEn: "Overdue unit cycle stages",
      titleAr: "مراحل متأخرة",
      messageEn: "Green Avenue: 24 units overdue in Contract",
      messageAr: "Green Avenue: 24 وحدة متأخرة في العقد",
      link: "/executive/overdue-tasks?project=green-avenue&stage=CONTRACT",
      dedupeKey: "unit-cycle-overdue:proj:CONTRACT:2026-11-05",
    });

    expect(count).toBe(1);
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "ACTIVITY",
          inboxTab: "OVERDUE_TASKS",
          dedupeKey: "unit-cycle-overdue:proj:CONTRACT:2026-11-05",
        }),
      })
    );
  });
});

describe("groupOverdueStagesForDigest", () => {
  it("aggregates unit counts per project and stage", async () => {
    const { groupOverdueStagesForDigest } = await import(
      "@/lib/unit-cycle/overdue-digest"
    );

    const overdueRowBase = {
      deadlineAt: null,
      overdue: true,
      checklistComplete: false,
      checklistPassed: 0,
      checklistTotal: 1,
      ownerAssigneeName: null,
      assigneeUserId: null,
      assignedUserId: null,
      unitAgentId: null,
      claimable: false,
    } as const;

    const groups = groupOverdueStagesForDigest([
      {
        unitCycleId: "c1",
        unitId: "u1",
        unitCode: "GA-1",
        projectId: "p1",
        projectName: "Green Avenue",
        stageKey: "CONTRACT",
        status: "IN_PROGRESS",
        daysOverdue: 3,
        ownerRole: "MANAGEMENT",
        ...overdueRowBase,
      },
      {
        unitCycleId: "c2",
        unitId: "u2",
        unitCode: "GA-2",
        projectId: "p1",
        projectName: "Green Avenue",
        stageKey: "CONTRACT",
        status: "IN_PROGRESS",
        daysOverdue: 5,
        ownerRole: "MANAGEMENT",
        ...overdueRowBase,
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.unitCount).toBe(2);
    expect(groups[0]?.stageKey).toBe("CONTRACT");
  });
});
