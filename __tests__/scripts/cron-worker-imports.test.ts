import { describe, expect, it } from "vitest";

describe("cron worker module graph", () => {
  it("imports request escalation job without server-only guard", async () => {
    const mod = await import("@/lib/requests/escalation");
    expect(typeof mod.runRequestEscalationJob).toBe("function");
    expect(typeof mod.getRequestEscalationCronSchedule).toBe("function");
  });

  it("imports request audit helper used by escalation", async () => {
    const mod = await import("@/lib/requests/audit");
    expect(typeof mod.recordRequestAuditEvent).toBe("function");
  });

  it("imports cron-imports smoke script entry", async () => {
    await expect(import("../../scripts/cron-imports")).resolves.toBeDefined();
  });
});
