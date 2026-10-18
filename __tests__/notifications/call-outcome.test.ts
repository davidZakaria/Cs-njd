import { describe, expect, it } from "vitest";

import { parseCallLogOutcome } from "@/lib/notifications/call-outcome";

describe("parseCallLogOutcome", () => {
  it("detects answered calls", () => {
    expect(parseCallLogOutcome("📞 Answered — client will visit site")).toBe(
      "answered"
    );
  });

  it("detects not answered calls", () => {
    expect(parseCallLogOutcome("📞 Not answered, will retry")).toBe(
      "not_answered"
    );
  });
});
