import { describe, expect, it } from "vitest";
import {
  selectOptionItems,
  selectOptionLabel,
} from "@/lib/ui/select-option-label";

describe("selectOptionLabel", () => {
  const options = [
    { value: "all", label: "Any item" },
    { value: "finishingContract", label: "Finishing contract" },
  ] as const;

  it("returns the matching option label instead of the raw value", () => {
    expect(selectOptionLabel(options, "all")).toBe("Any item");
    expect(selectOptionLabel(options, "finishingContract")).toBe(
      "Finishing contract"
    );
  });

  it("falls back to the value when no option matches", () => {
    expect(selectOptionLabel(options, "unknown")).toBe("unknown");
  });
});

describe("selectOptionItems", () => {
  it("builds a value-to-label map for select items prop", () => {
    expect(
      selectOptionItems([
        { value: "all", label: "All projects" },
        { value: "jamila", label: "Jamila" },
      ])
    ).toEqual({ all: "All projects", jamila: "Jamila" });
  });
});
