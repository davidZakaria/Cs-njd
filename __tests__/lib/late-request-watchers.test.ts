import { describe, expect, it, vi, beforeEach } from "vitest";

const mockUserFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  basePrisma: {},
}));

describe("resolveLateRequestWatcherUserIds", () => {
  beforeEach(() => {
    mockUserFindMany.mockReset();
  });

  it("defaults to active management and applies include/exclude", async () => {
    mockUserFindMany
      .mockResolvedValueOnce([
        { id: "mgmt-1" },
        { id: "mgmt-2" },
      ])
      .mockResolvedValueOnce([
        { id: "mgmt-1" },
        { id: "extra-1" },
      ]);

    const { resolveLateRequestWatcherUserIds } = await import(
      "@/lib/requests/late-request-watchers"
    );

    const prisma = {
      user: { findMany: mockUserFindMany },
      systemSetting: { findUnique: vi.fn() },
    };

    const ids = await resolveLateRequestWatcherUserIds(prisma as never, {
      include: ["extra-1", "extra-1"],
      exclude: ["mgmt-2"],
    });

    expect(ids).toEqual(["mgmt-1", "extra-1"]);
    expect(mockUserFindMany).toHaveBeenCalledTimes(2);
  });

  it("dedupes users included through multiple roles", async () => {
    mockUserFindMany
      .mockResolvedValueOnce([{ id: "mgmt-1" }])
      .mockResolvedValueOnce([{ id: "mgmt-1" }]);

    const { resolveLateRequestWatcherUserIds } = await import(
      "@/lib/requests/late-request-watchers"
    );

    const prisma = {
      user: { findMany: mockUserFindMany },
      systemSetting: { findUnique: vi.fn() },
    };

    const ids = await resolveLateRequestWatcherUserIds(prisma as never, {
      include: ["mgmt-1"],
      exclude: [],
    });

    expect(ids).toEqual(["mgmt-1"]);
  });
});