import { describe, expect, it } from "vitest";

import {
  formatPhoneForDisplay,
  sanitizePhoneForStorage,
} from "@/lib/phone/display";

describe("phone display helpers", () => {
  it("strips Excel .0 suffix for display", () => {
    expect(formatPhoneForDisplay("96599034830.0")).toBe("96599034830");
  });

  it("leaves normal phones unchanged", () => {
    expect(formatPhoneForDisplay("01001234567")).toBe("01001234567");
  });

  it("sanitizePhoneForStorage is idempotent", () => {
    expect(sanitizePhoneForStorage("0100.0")).toBe("0100");
    expect(sanitizePhoneForStorage("0100")).toBe("0100");
    expect(sanitizePhoneForStorage(null)).toBeNull();
  });
});