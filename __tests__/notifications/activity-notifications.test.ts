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

describe("dispatch activity notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationCreateMany.mockResolvedValue({ count: 1 });
  });

  it("notifies management and assigned CS agent for Jamila call logs", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "mgmt-1", role: "MANAGEMENT", email: "m@njd.com" },
      { id: "agent-1", role: "CS_AGENT", email: "a@njd.com" },
      { id: "agent-2", role: "CS_AGENT", email: "b@njd.com" },
      { id: "community-1", role: "COMMUNITY_MANAGEMENT", email: "c@njd.com" },
    ]);

    const { dispatchActivityNotification } = await import(
      "@/lib/notifications/dispatch-activity-notifications"
    );

    await dispatchActivityNotification({
      kind: "call_log",
      actorUserId: "community-1",
      actorName: "Community Agent",
      unit: {
        id: "unit-1",
        unitCode: "J-101",
        agentId: "agent-1",
        projectId: "proj-jamila",
        project: { id: "proj-jamila", name: "JAMILA NORTH COAST" },
        client: { name: "Client A" },
      },
      notes: "📞 Answered — follow up tomorrow",
    });

    expect(mockNotificationCreateMany).toHaveBeenCalledTimes(1);
    const payload = mockNotificationCreateMany.mock.calls[0][0];
    const userIds = payload.data.map((row: { userId: string }) => row.userId);
    expect(userIds).toContain("mgmt-1");
    expect(userIds).toContain("agent-1");
    expect(userIds).toContain("community-1");
    expect(userIds).not.toContain("agent-2");
    expect(payload.data[0].kind).toBe("ACTIVITY");
  });

  it("hides non-Jamila activity from community users", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "mgmt-1", role: "MANAGEMENT", email: "m@njd.com" },
      { id: "community-1", role: "COMMUNITY_MANAGEMENT", email: "c@njd.com" },
    ]);

    const { dispatchActivityNotification } = await import(
      "@/lib/notifications/dispatch-activity-notifications"
    );

    await dispatchActivityNotification({
      kind: "ticket_created",
      actorUserId: "mgmt-1",
      actorName: "Manager",
      unit: {
        id: "unit-2",
        unitCode: "GA-12",
        agentId: null,
        projectId: "proj-ga",
        project: { id: "proj-ga", name: "GREEN AVENUE" },
        client: { name: "Client B" },
      },
      notes: "New general case",
    });

    const payload = mockNotificationCreateMany.mock.calls[0][0];
    const userIds = payload.data.map((row: { userId: string }) => row.userId);
    expect(userIds).toEqual(["mgmt-1"]);
  });
});
