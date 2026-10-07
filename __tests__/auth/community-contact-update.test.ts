import { describe, expect, it } from "vitest";
import { validateCommunityClientContactUpdate } from "@/lib/auth/community-contact-update";

const baseClient = {
  name: "Client A",
  phone1: "0100",
  phone2: null,
  email: "a@example.com",
  nationalId: "123",
  address1: "Street 1",
  address2: null,
};

describe("validateCommunityClientContactUpdate", () => {
  it("allows filling empty secondary phone and address", () => {
    const result = validateCommunityClientContactUpdate(baseClient, {
      clientName: "Client A",
      phone1: "0100",
      phone2: "0111",
      email: "a@example.com",
      nationalId: "123",
      address1: "Street 1",
      address2: "Street 2",
    });

    expect(result).toEqual({ phone2: "0111", address2: "Street 2" });
  });

  it("rejects changing primary phone", () => {
    const result = validateCommunityClientContactUpdate(baseClient, {
      clientName: baseClient.name,
      phone1: "0999",
      phone2: baseClient.phone2,
      email: baseClient.email,
      nationalId: baseClient.nationalId,
      address1: baseClient.address1,
      address2: baseClient.address2,
    });

    expect(result).toMatchObject({ success: false, error: "Cannot change primary phone number" });
  });

  it("rejects changing existing secondary phone", () => {
    const result = validateCommunityClientContactUpdate(
      { ...baseClient, phone2: "0111", address2: "Street 2" },
      {
        clientName: baseClient.name,
        phone1: baseClient.phone1,
        phone2: "0222",
        email: baseClient.email,
        nationalId: baseClient.nationalId,
        address1: baseClient.address1,
        address2: "Street 2",
      }
    );

    expect(result).toMatchObject({
      success: false,
      error: "Cannot change or remove secondary phone number",
    });
  });
});
