import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unitCycleStage: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  classifyRetroactiveUnitCycleDeadline,
  computeForwardStageDeadline,
} from "@/lib/unit-cycle/deadlines";

describe("cleanup-retroactive-unit-cycle-deadlines", () => {
  it("groups fixable rows by reason", async () => {
    const now = new Date("2026-03-01T00:00:00.000Z");
    const cycleCreated = new Date("2024-06-01T00:00:00.000Z");
    const startedAt = new Date("2024-06-01T10:00:00.000Z");
    const staleDeadline = new Date("2024-06-03T00:00:00.000Z");

    const reason = classifyRetroactiveUnitCycleDeadline({
      status: "IN_PROGRESS",
      startedAt,
      deadlineAt: staleDeadline,
      unitCycleCreatedAt: cycleCreated,
      now,
    });
    expect(reason).toBe("active_deadline_in_past");

    const fixed = computeForwardStageDeadline(startedAt, 5, now);
    expect(fixed.getTime()).toBeGreaterThan(now.getTime());

    vi.mocked(prisma.unitCycleStage.findMany).mockResolvedValue([
      {
        id: "stage-1",
        status: "IN_PROGRESS",
        startedAt,
        deadlineAt: staleDeadline,
        stageKey: "CONTRACT",
        unitCycle: {
          createdAt: cycleCreated,
          unit: {
            unitCode: "GA-001",
            project: {
              name: "GREEN AVENUE",
              unitCycleContractDeadlineDays: 5,
              unitCycleFinanceDeadlineDays: 5,
              unitCycleEngineeringDeadlineDays: 7,
              unitCycleLegalHandoverDeadlineDays: 7,
            },
          },
        },
      },
    ] as never);

    const rows = await prisma.unitCycleStage.findMany({} as never);
    expect(rows).toHaveLength(1);
  });
});