import { describe, expect, it } from "vitest";

import {
  dedupeTimelineTickets,
  normalizeTimelineNoteKey,
} from "@/lib/cases/timeline-dedupe";

describe("timeline dedupe", () => {
  it("normalizes note whitespace", () => {
    expect(normalizeTimelineNoteKey("  Foo \n Bar  ")).toBe("foo bar");
  });

  it("keeps newest ticket when notes duplicate on same unit", () => {
    const tickets = [
      {
        id: "new",
        unitId: "u1",
        notes: "Same note",
        category: "CUSTOMER_SERVICE",
        createdAt: new Date("2026-01-02"),
      },
      {
        id: "old",
        unitId: "u1",
        notes: "Same note",
        category: "FEEDBACK_HISTORY",
        createdAt: new Date("2026-01-01"),
      },
    ];
    const result = dedupeTimelineTickets(tickets);
    expect(result.map((t) => t.id)).toEqual(["new"]);
  });

  it("does not dedupe across different units", () => {
    const tickets = [
      {
        id: "a",
        unitId: "u1",
        notes: "Same",
        category: "GENERAL",
        createdAt: new Date(),
      },
      {
        id: "b",
        unitId: "u2",
        notes: "Same",
        category: "GENERAL",
        createdAt: new Date(),
      },
    ];
    expect(dedupeTimelineTickets(tickets)).toHaveLength(2);
  });
});