import { describe, expect, it } from "vitest";

import {
  clampPageIndex,
  listPageCount,
  listPageSlice,
} from "@/lib/ui/list-pagination";

describe("list-pagination", () => {
  it("paginates filtered lists across pages", () => {
    const items = Array.from({ length: 25 }, (_, i) => i + 1);
    expect(listPageCount(items.length, 20)).toBe(2);
    expect(listPageSlice(items, 0, 20)).toHaveLength(20);
    expect(listPageSlice(items, 1, 20)).toEqual([21, 22, 23, 24, 25]);
  });

  it("clamps page index when filters shrink the result set", () => {
    expect(clampPageIndex(3, 25, 20)).toBe(1);
    expect(clampPageIndex(0, 0, 20)).toBe(0);
  });
});
