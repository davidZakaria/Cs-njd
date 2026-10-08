import { describe, expect, it } from "vitest";
import {
  validateCommunityExtraAddressAdd,
  validateCommunityExtraPhoneAdd,
} from "@/lib/auth/community-contact-add";

const baseClient = {
  phone1: "0100",
  phone2: null,
  address1: "Street 1",
  address2: null,
  phones: [{ id: "p1", phone: "0111", sortOrder: 0 }],
  addresses: [],
};

describe("validateCommunityExtraPhoneAdd", () => {
  it("allows a new unique phone", () => {
    const result = validateCommunityExtraPhoneAdd(baseClient, "0222");
    expect(result).toEqual({ phone: "0222" });
  });

  it("rejects duplicate of primary phone", () => {
    const result = validateCommunityExtraPhoneAdd(baseClient, "0100");
    expect(result).toMatchObject({
      success: false,
      error: "This phone number is already on file",
    });
  });

  it("rejects duplicate of existing extra phone", () => {
    const result = validateCommunityExtraPhoneAdd(baseClient, "0111");
    expect(result).toMatchObject({
      success: false,
      error: "This phone number is already on file",
    });
  });
});

describe("validateCommunityExtraAddressAdd", () => {
  it("allows a new unique address", () => {
    const result = validateCommunityExtraAddressAdd(baseClient, "Street 9");
    expect(result).toEqual({ address: "Street 9" });
  });
});
