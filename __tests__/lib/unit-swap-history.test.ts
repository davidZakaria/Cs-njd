import { describe, expect, it } from "vitest";

import { formatUnitSwapHistoryMessage } from "@/lib/units/unit-swap-history";

describe("unit-swap-history", () => {
  it("formats outgoing swap in locale with Cairo timezone fields", () => {
    const at = new Date("2026-10-27T10:30:00.000Z");
    const message = formatUnitSwapHistoryMessage({
      locale: "en",
      tOutgoing: (key, values) =>
        key === "outgoingMessage"
          ? `OUT ${values.clientName} ${values.unitCode} ${values.date}`
          : key,
      tIncoming: () => "",
      unit: {
        swapHistoryNote: null,
        swapOutgoingUnitId: "tgt",
        swapOutgoingUnitCode: "B-12",
        swapOutgoingProjectName: "Green",
        swapOutgoingAt: at,
        swapOutgoingByName: "Admin",
        swapOutgoingClientName: "Ahmed",
        swappedFromUnitId: null,
        swappedFromUnitCode: null,
        swappedFromProjectName: null,
        swappedFromAt: null,
        swappedFromByName: null,
      },
    });
    expect(message).toContain("OUT Ahmed B-12");
    expect(message).not.toContain("2026-10-27T10:30:00.000Z");
  });
});
