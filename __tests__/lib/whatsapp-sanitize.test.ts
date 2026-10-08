import { describe, expect, it } from "vitest";
import { sanitizePhoneForWhatsApp } from "@/lib/format/whatsapp";

describe("sanitizePhoneForWhatsApp", () => {
  it("normalizes Egyptian local mobile", () => {
    expect(sanitizePhoneForWhatsApp("01055506196")).toBe("201055506196");
  });

  it("accepts international numbers with country code", () => {
    expect(sanitizePhoneForWhatsApp("+971 50 318 2246")).toBe("971503182246");
  });

  it("accepts numbers already prefixed with +20", () => {
    expect(sanitizePhoneForWhatsApp("+20 105 550 6196")).toBe("201055506196");
  });
});
