import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTicketFindMany = vi.fn();
const mockNotificationFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  basePrisma: {
    ticket: { findMany: (...args: unknown[]) => mockTicketFindMany(...args) },
    notification: {
      findMany: (...args: unknown[]) => mockNotificationFindMany(...args),
    },
  },
}));

describe("call log seen status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks seen when CS agent notification has readAt", async () => {
    mockTicketFindMany.mockResolvedValue([
      {
        id: "t1",
        unit: {
          agentId: "agent-1",
          agent: { id: "agent-1", name: "CS Agent", email: "a@njd.com" },
        },
      },
    ]);
    mockNotificationFindMany.mockResolvedValue([
      {
        dedupeKey: "call-log:t1",
        userId: "agent-1",
        isRead: true,
        readAt: new Date("2026-11-22T14:30:00.000Z"),
      },
    ]);

    const { attachCallLogSeenToItems } = await import(
      "@/lib/notifications/call-log-seen"
    );

    const map = await attachCallLogSeenToItems(
      [{ id: "n-mgmt", dedupeKey: "call-log:t1" }],
      "MANAGEMENT"
    );

    expect(map.get("n-mgmt")).toEqual({
      kind: "seen",
      agentName: "CS Agent",
      readAt: "2026-11-22T14:30:00.000Z",
    });
  });

  it("reports not seen when agent notification is unread", async () => {
    mockTicketFindMany.mockResolvedValue([
      {
        id: "t2",
        unit: {
          agentId: "agent-1",
          agent: { id: "agent-1", name: "CS Agent", email: null },
        },
      },
    ]);
    mockNotificationFindMany.mockResolvedValue([
      {
        dedupeKey: "call-log:t2",
        userId: "agent-1",
        isRead: false,
        readAt: null,
      },
    ]);

    const { attachCallLogSeenToItems } = await import(
      "@/lib/notifications/call-log-seen"
    );

    const map = await attachCallLogSeenToItems(
      [{ id: "n-mgmt", dedupeKey: "call-log:t2" }],
      "MANAGEMENT"
    );

    expect(map.get("n-mgmt")).toEqual({
      kind: "not_seen",
      agentName: "CS Agent",
      readAt: null,
    });
  });

  it("reports no CS agent when unit is unassigned", async () => {
    mockTicketFindMany.mockResolvedValue([
      {
        id: "t3",
        unit: { agentId: null, agent: null },
      },
    ]);

    const { attachCallLogSeenToItems } = await import(
      "@/lib/notifications/call-log-seen"
    );

    const map = await attachCallLogSeenToItems(
      [{ id: "n-mgmt", dedupeKey: "call-log:t3" }],
      "MANAGEMENT"
    );

    expect(map.get("n-mgmt")).toEqual({
      kind: "no_agent",
      agentName: null,
      readAt: null,
    });
    expect(mockNotificationFindMany).not.toHaveBeenCalled();
  });

  it("skips seen labels for CS agents", async () => {
    const { attachCallLogSeenToItems } = await import(
      "@/lib/notifications/call-log-seen"
    );

    const map = await attachCallLogSeenToItems(
      [{ id: "n-agent", dedupeKey: "call-log:t1" }],
      "CS_AGENT"
    );

    expect(map.size).toBe(0);
    expect(mockTicketFindMany).not.toHaveBeenCalled();
  });
});