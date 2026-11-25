import { describe, expect, it } from "vitest";

import {
  parseLateRequestWatchersValue,
  serializeLateRequestWatchersValue,
} from "@/lib/system/late-request-watchers-config";

describe("lateRequestWatchers config", () => {
  it("round-trips include and exclude lists", () => {
    const raw = serializeLateRequestWatchersValue({
      include: ["a", "a", "b"],
      exclude: ["c"],
    });
    expect(parseLateRequestWatchersValue(raw)).toEqual({
      include: ["a", "b"],
      exclude: ["c"],
    });
  });

  it("falls back to empty lists for invalid JSON", () => {
    expect(parseLateRequestWatchersValue("{")).toEqual({
      include: [],
      exclude: [],
    });
  });
});