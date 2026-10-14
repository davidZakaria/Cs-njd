import { AsyncLocalStorage } from "async_hooks";
import { describe, expect, it, vi } from "vitest";

const auditContext = new AsyncLocalStorage<{ userId?: string }>();

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: () => "203.0.113.1",
  }),
}));

vi.mock("@/lib/prisma", () => ({
  auditContext,
}));

describe("withAudit", () => {
  it("keeps audit context active until the wrapped work finishes", async () => {
    const { withAudit } = await import("@/lib/audit/with-audit");

    let userIdDuringDeferredWork: string | undefined;
    await withAudit(async () => {
      await new Promise<void>((resolve) => {
        setImmediate(() => {
          userIdDuringDeferredWork = auditContext.getStore()?.userId;
          resolve();
        });
      });
    });

    expect(userIdDuringDeferredWork).toBe("user-1");
  });

  it("drops context when run returns an unawaited lazy query (regression guard)", async () => {
    let userIdDuringDeferredWork: string | undefined;

    const lazyQuery = new Promise<void>((resolve) => {
      setImmediate(() => {
        userIdDuringDeferredWork = auditContext.getStore()?.userId;
        resolve();
      });
    });

    auditContext.run({ userId: "user-1" }, () => lazyQuery);
    await lazyQuery;

    expect(userIdDuringDeferredWork).toBeUndefined();
  });
});
