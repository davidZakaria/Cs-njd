import { describe, expect, it } from "vitest";

import {
  dedupeTimelineTickets,
  isTimelineProtectedTicket,
  normalizeTimelineNoteKey,
  TIMELINE_HISTORY_DEDUPE_WINDOW_MS,
} from "@/lib/cases/timeline-dedupe";

const DUP_NOTE = "ملاحظة متابعة — نفس النص في استيراد Excel";

describe("timeline dedupe", () => {
  it("normalizes note whitespace", () => {
    expect(normalizeTimelineNoteKey("  Foo \n Bar  ")).toBe("foo bar");
  });

  it("keeps open ticket when resolved history repeats the same note (history newer)", () => {
    const tickets = [
      {
        id: "history-newer",
        unitId: "u1",
        notes: DUP_NOTE,
        category: "FEEDBACK_HISTORY",
        status: "RESOLVED",
        agentId: "agent-1",
        createdAt: new Date("2026-02-02"),
      },
      {
        id: "open-pending",
        unitId: "u1",
        notes: DUP_NOTE,
        category: "CUSTOMER_SERVICE",
        status: "PENDING",
        agentId: "agent-1",
        createdAt: new Date("2026-02-01"),
      },
    ];
    const result = dedupeTimelineTickets(tickets);
    expect(result.map((t) => t.id)).toEqual(["open-pending"]);
    expect(isTimelineProtectedTicket(result[0]!)).toBe(true);
  });

  it("keeps open ticket when history is older", () => {
    const tickets = [
      {
        id: "open",
        unitId: "u1",
        notes: "Same note",
        category: "CUSTOMER_SERVICE",
        status: "PENDING",
        createdAt: new Date("2026-01-02"),
      },
      {
        id: "history",
        unitId: "u1",
        notes: "Same note",
        category: "FEEDBACK_HISTORY",
        status: "RESOLVED",
        createdAt: new Date("2026-01-01"),
      },
    ];
    expect(dedupeTimelineTickets(tickets).map((t) => t.id)).toEqual(["open"]);
  });

  it("collapses duplicate history-only rows within the dedupe window", () => {
    const at = new Date("2026-03-01T12:00:00Z");
    const tickets = [
      {
        id: "h1",
        unitId: "u1",
        notes: "Excel duplicate",
        category: "FEEDBACK_HISTORY",
        status: "RESOLVED",
        agentId: "a1",
        createdAt: at,
      },
      {
        id: "h2",
        unitId: "u1",
        notes: "Excel duplicate",
        category: "FEEDBACK_HISTORY",
        status: "RESOLVED",
        agentId: "a1",
        createdAt: new Date(at.getTime() + TIMELINE_HISTORY_DEDUPE_WINDOW_MS - 1000),
      },
    ];
    expect(dedupeTimelineTickets(tickets).map((t) => t.id)).toEqual(["h1"]);
  });

  it("does not dedupe across different units", () => {
    const tickets = [
      {
        id: "a",
        unitId: "u1",
        notes: "Same",
        category: "GENERAL",
        status: "PENDING",
        createdAt: new Date(),
      },
      {
        id: "b",
        unitId: "u2",
        notes: "Same",
        category: "GENERAL",
        status: "PENDING",
        createdAt: new Date(),
      },
    ];
    expect(dedupeTimelineTickets(tickets)).toHaveLength(2);
  });

  it("cases list: never drops an open ticket when a history row shares its note", () => {
    const casesRows = [
      {
        id: "case-open",
        unitId: "unit-walk",
        notes: DUP_NOTE,
        category: "CUSTOMER_SERVICE",
        status: "PENDING",
        createdAt: new Date("2026-01-10"),
      },
      {
        id: "case-history",
        unitId: "unit-walk",
        notes: DUP_NOTE,
        category: "FEEDBACK_HISTORY",
        status: "RESOLVED",
        createdAt: new Date("2026-01-11"),
      },
      {
        id: "other-unit",
        unitId: "unit-other",
        notes: DUP_NOTE,
        category: "CUSTOMER_SERVICE",
        status: "ENGINEERING",
        createdAt: new Date("2026-01-09"),
      },
    ];
    const display = dedupeTimelineTickets(casesRows);
    expect(display.map((r) => r.id).sort()).toEqual(["case-open", "other-unit"]);
  });
});