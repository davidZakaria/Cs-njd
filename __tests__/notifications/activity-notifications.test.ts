import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUserFindMany = vi.fn();
const mockNotificationCreateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  basePrisma: {
    user: { findMany: (...args: unknown[]) => mockUserFindMany(...args) },
    notification: {
      createMany: (...args: unknown[]) => mockNotificationCreateMany(...args),
    },
  },
}));

vi.mock("@/lib/auth/cs-agent-scope", () => ({
  resolveCsAgentScope: async (user: { id: string }) => ({
    loginUserId: user.id,
    effectiveAgentId: user.id,
    isPreview: false,
  }),
}));

describe("dispatch call log activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationCreateMany.mockResolvedValue({ count: 1 });
  });

  const jamilaUnit = {
    id: "unit-1",
    unitCode: "J-101",
    agentId: "agent-1",
    projectId: "proj-jamila",
    project: { id: "proj-jamila", name: "JAMILA NORTH COAST" },
    client: { name: "Client A" },
  };

  async function loadDispatch() {
    return import("@/lib/notifications/dispatch-activity-notifications");
  }

  it("notifies management and assigned CS agent for answered calls", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "mgmt-1", role: "MANAGEMENT", email: "m@njd.com" },
      { id: "agent-1", role: "CS_AGENT", email: "a@njd.com" },
      { id: "agent-2", role: "CS_AGENT", email: "b@njd.com" },
      { id: "community-1", role: "COMMUNITY_MANAGEMENT", email: "c@njd.com" },
    ]);

    const { dispatchCallLogActivity } = await loadDispatch();

    await dispatchCallLogActivity({
      actorUserId: "community-1",
      actorName: "Community Agent",
      unit: jamilaUnit,
      notes: "عند الاتصال مع العميلة",
      callLogOutcome: "ANSWERED",
    });

    expect(mockNotificationCreateMany).toHaveBeenCalledTimes(1);
    const payload = mockNotificationCreateMany.mock.calls[0][0];
    const userIds = payload.data.map((row: { userId: string }) => row.userId);
    expect(userIds).toContain("mgmt-1");
    expect(userIds).toContain("agent-1");
    expect(userIds).not.toContain("community-1");
    expect(userIds).not.toContain("agent-2");
    expect(payload.data[0].kind).toBe("ACTIVITY");
    expect(payload.data[0].inboxTab).toBe("CALL_LOG");
  });

  it("notifies for no-answer and other outcomes", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "mgmt-1", role: "MANAGEMENT", email: "m@njd.com" },
    ]);

    const { dispatchCallLogActivity } = await loadDispatch();

    for (const callLogOutcome of ["NO_ANSWER", "OTHER"] as const) {
      await dispatchCallLogActivity({
        actorUserId: "mgmt-1",
        actorName: "Manager",
        unit: jamilaUnit,
        notes: "Will retry tomorrow",
        callLogOutcome,
      });
    }

    expect(mockNotificationCreateMany).toHaveBeenCalledTimes(2);
  });

  it("notifies management when unit has no assigned agent", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "mgmt-1", role: "MANAGEMENT", email: "m@njd.com" },
      { id: "community-1", role: "COMMUNITY_MANAGEMENT", email: "c@njd.com" },
    ]);

    const { dispatchCallLogActivity } = await loadDispatch();

    await dispatchCallLogActivity({
      actorUserId: "logger-outside",
      actorName: "Manager",
      unit: {
        id: "unit-2",
        unitCode: "GA-12",
        agentId: null,
        projectId: "proj-ga",
        project: { id: "proj-ga", name: "GREEN AVENUE" },
        client: { name: "Client B" },
      },
      notes: "Follow up next week",
      callLogOutcome: "OTHER",
    });

    const payload = mockNotificationCreateMany.mock.calls[0][0];
    const userIds = payload.data.map((row: { userId: string }) => row.userId);
    expect(userIds).toContain("mgmt-1");
    expect(userIds).toContain("community-1");
  });

  it("excludes the user who logged the call", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "mgmt-1", role: "MANAGEMENT", email: "m@njd.com" },
      { id: "agent-1", role: "CS_AGENT", email: "a@njd.com" },
    ]);

    const { dispatchCallLogActivity } = await loadDispatch();

    await dispatchCallLogActivity({
      actorUserId: "agent-1",
      actorName: "CS Agent",
      unit: jamilaUnit,
      notes: "Spoke with client",
      callLogOutcome: "ANSWERED",
    });

    const payload = mockNotificationCreateMany.mock.calls[0][0];
    const userIds = payload.data.map((row: { userId: string }) => row.userId);
    expect(userIds).toContain("mgmt-1");
    expect(userIds).not.toContain("agent-1");
  });
});