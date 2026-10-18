import { describe, expect, it } from "vitest";

import { analyzeJointOwnerName } from "@/lib/import/split-joint-owner-name";

describe("analyzeJointOwnerName", () => {
  it("splits on slash with optional spaces", () => {
    const result = analyzeJointOwnerName("Ahmed Ali / Sara Hamed");
    expect(result.kind).toBe("split");
    if (result.kind === "split") {
      expect(result.parts).toEqual(["Ahmed Ali", "Sara Hamed"]);
    }
  });

  it("flags guardianship wording as needs review", () => {
    const result = analyzeJointOwnerName("Client Name بولايه Minor");
    expect(result.kind).toBe("needsReview");
  });

  it("does not split hyphenated first names", () => {
    expect(analyzeJointOwnerName("Jean-Pierre").kind).toBe("none");
  });
});
