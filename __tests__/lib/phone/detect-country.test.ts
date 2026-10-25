import { describe, expect, it } from "vitest";

import {
  countryFlagEmoji,
  detectPhoneCountry,
  localizedCountryName,
} from "@/lib/phone/detect-country";

describe("detectPhoneCountry", () => {
  it("detects US numbers without a leading plus", () => {
    expect(detectPhoneCountry("12019207944")).toEqual({
      countryCode: "US",
      isUnknown: false,
    });
  });

  it("detects Egyptian numbers starting with 0", () => {
    expect(detectPhoneCountry("01001234567")).toEqual({
      countryCode: "EG",
      isUnknown: false,
    });
  });

  it("detects Saudi numbers from digit strings", () => {
    expect(detectPhoneCountry("966501234567")).toEqual({
      countryCode: "SA",
      isUnknown: false,
    });
  });

  it("detects UAE numbers from digit strings", () => {
    expect(detectPhoneCountry("971501234567")).toEqual({
      countryCode: "AE",
      isUnknown: false,
    });
  });

  it("detects UK numbers from digit strings", () => {
    expect(detectPhoneCountry("447911123456")).toEqual({
      countryCode: "GB",
      isUnknown: false,
    });
  });

  it("parses international prefixes with + and 00", () => {
    expect(detectPhoneCountry("+966501234567").countryCode).toBe("SA");
    expect(detectPhoneCountry("00966501234567").countryCode).toBe("SA");
  });

  it("returns unknown for garbage input", () => {
    expect(detectPhoneCountry("not-a-phone")).toEqual({
      countryCode: null,
      isUnknown: true,
    });
    expect(detectPhoneCountry("")).toEqual({
      countryCode: null,
      isUnknown: true,
    });
  });
});

describe("country display helpers", () => {
  it("builds flag emoji from region codes", () => {
    expect(countryFlagEmoji("EG")).toBe("🇪🇬");
    expect(countryFlagEmoji("us")).toBe("🇺🇸");
  });

  it("localizes country names", () => {
    expect(localizedCountryName("EG", "en")).toBe("Egypt");
    expect(localizedCountryName("EG", "ar")).toMatch(/مصر/);
  });
});
