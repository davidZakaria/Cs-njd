import { describe, expect, it } from "vitest";

import {
  formatLateRequestDigestMessage,
  formatOldestLateSuffixEn,
  formatOldestLateSuffixAr,
  groupLateRequestsForDigest,
} from "@/lib/requests/overdue-digest";

describe("late request digest", () => {
  const now = new Date("2026-11-20T12:00:00.000Z");

  it("groups by department and request type", () => {
    const groups = groupLateRequestsForDigest(
      [
        {
          type: "CONTRACT_ISSUE_OR_AMENDMENT",
          currentApproverKind: "LEGAL",
          dueDate: new Date("2026-11-15T00:00:00.000Z"),
        },
        {
          type: "CONTRACT_ISSUE_OR_AMENDMENT",
          currentApproverKind: "LEGAL",
          dueDate: new Date("2026-11-10T00:00:00.000Z"),
        },
      ],
      now
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(2);
    expect(groups[0]?.department).toBe("LEGAL");
    expect(groups[0]?.oldestDaysLate).toBe(10);
  });

  it("formats bilingual digest messages", () => {
    const groups = groupLateRequestsForDigest(
      [
        {
          type: "CONTRACT_ISSUE_OR_AMENDMENT",
          currentApproverKind: "LEGAL",
          dueDate: new Date("2026-11-10T00:00:00.000Z"),
        },
        {
          type: "CONTRACT_ISSUE_OR_AMENDMENT",
          currentApproverKind: "LEGAL",
          dueDate: new Date("2026-11-12T00:00:00.000Z"),
        },
      ],
      now
    );

    const digest = formatLateRequestDigestMessage(groups);
    expect(digest.messageEn).toContain("2 late requests");
    expect(digest.messageEn).toContain("Legal");
    expect(digest.messageEn).toContain("contract issue/amendment");
    expect(digest.messageAr).toContain("القانونية");
  });

  it("uses natural oldest-overdue phrasing", () => {
    expect(formatOldestLateSuffixEn(1)).toBe("; oldest is 1 day late");
    expect(formatOldestLateSuffixEn(24)).toBe("; oldest is 24 days late");
    expect(formatOldestLateSuffixAr(1)).toContain("يوم واحد");
    expect(formatOldestLateSuffixAr(24)).toContain("يومًا");
  });
});