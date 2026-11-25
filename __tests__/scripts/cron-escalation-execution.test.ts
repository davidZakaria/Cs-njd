import { execSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

const notifyUserInboxTab = vi.fn();
const notifyRolesInboxTab = vi.fn();

vi.mock("@/lib/notifications/inbox-delivery", () => ({
  notifyUserInboxTab: (...args: unknown[]) => notifyUserInboxTab(...args),
  notifyRolesInboxTab: (...args: unknown[]) => notifyRolesInboxTab(...args),
}));

vi.mock("@/lib/requests/audit", () => ({
  recordRequestAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/unit-cycle/audit", () => ({
  recordUnitCycleAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/unit-cycle/queries", () => ({
  getOverdueStagesForManagement: vi.fn().mockResolvedValue([]),
}));

describe("cron escalation job execution", () => {
  beforeEach(() => {
    notifyUserInboxTab.mockReset();
    notifyRolesInboxTab.mockReset();
    notifyUserInboxTab.mockResolvedValue(false);
    notifyRolesInboxTab.mockResolvedValue(0);
  });

  it("executes request escalation job import path", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      unitRequest: {
        findMany,
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      systemSetting: { findUnique: vi.fn() },
    };

    const { runRequestEscalationJob } = await import("@/lib/requests/escalation");
    const result = await runRequestEscalationJob(prisma as never);
    expect(result).toEqual({ notified: 0, scanned: 0 });
  });

  it("executes unit cycle escalation job import path", async () => {
    const prisma = {
      user: { findFirst: vi.fn() },
      unitCycleStage: { findFirst: vi.fn(), update: vi.fn() },
    };

    const { runUnitCycleEscalationJob } = await import("@/lib/unit-cycle/escalation");
    const result = await runUnitCycleEscalationJob(prisma as never);
    expect(result.scanned).toBe(0);
  });

  it("executes archive gap escalation job import path", async () => {
    const prisma = {
      archiveCheckGapTask: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      unitRequest: { update: vi.fn() },
    };

    const { runArchiveCheckGapEscalationJob } = await import(
      "@/lib/archive-check/escalation"
    );
    const result = await runArchiveCheckGapEscalationJob(prisma as never);
    expect(result).toEqual({ notified: 0, scanned: 0 });
  });

  it("runs tsx cron-imports smoke script", () => {
    const root = path.resolve(__dirname, "../..");
    const output = execSync("npx tsx scripts/cron-imports.ts", {
      cwd: root,
      env: {
        ...process.env,
        SKIP_ENV_VALIDATION: "true",
        DATABASE_URL: "postgresql://test:test@localhost:5432/test",
        AUTH_SECRET: "test-secret-at-least-32-characters-long",
      },
      encoding: "utf8",
    });
    expect(output).toContain("[cron-imports] ok");
  });
});