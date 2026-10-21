import { describe, expect, it } from "vitest";

import {
  validateCsClientIdentityUpdate,
  validateCsClientPrimaryContactUpdate,
  validateCsExtraContactLines,
} from "@/lib/clients/cs-identity-guard";

describe("validateCsClientIdentityUpdate", () => {
  it("rejects clearing an existing name", () => {
    expect(
      validateCsClientIdentityUpdate(
        { name: "Ahmed", nationalId: null },
        { name: "  ", nationalId: null }
      )
    ).toBe("Client name cannot be cleared");
  });

  it("rejects clearing an existing national ID", () => {
    expect(
      validateCsClientIdentityUpdate(
        { name: "Ahmed", nationalId: "123" },
        { name: "Ahmed", nationalId: "" }
      )
    ).toBe("National ID cannot be cleared");
  });

  it("allows updates when values stay meaningful", () => {
    expect(
      validateCsClientIdentityUpdate(
        { name: "Ahmed", nationalId: "123" },
        { name: "Ahmed Ali", nationalId: "456" }
      )
    ).toBeNull();
  });

  it("allows keeping empty identity when already empty", () => {
    expect(
      validateCsClientIdentityUpdate(
        { name: "", nationalId: null },
        { name: "", nationalId: null }
      )
    ).toBeNull();
  });

  it("rejects clearing an existing email", () => {
    expect(
      validateCsClientIdentityUpdate(
        { name: "Ahmed", nationalId: null, email: "a@test.com" },
        { name: "Ahmed", nationalId: null, email: null }
      )
    ).toBe("Email cannot be cleared");
  });
});

describe("validateCsClientPrimaryContactUpdate", () => {
  it("rejects clearing primary phone and address", () => {
    expect(
      validateCsClientPrimaryContactUpdate(
        { phone1: "0100", address1: "Street" },
        { phone1: null, address1: "Street" }
      )
    ).toBe("Primary phone cannot be cleared");
    expect(
      validateCsClientPrimaryContactUpdate(
        { phone1: "0100", address1: "Street" },
        { phone1: "0100", address1: null }
      )
    ).toBe("Primary address cannot be cleared");
  });
});

describe("validateCsExtraContactLines", () => {
  it("rejects blanking a persisted extra phone", () => {
    expect(
      validateCsExtraContactLines(
        [{ id: "p1", value: "0111" }],
        [{ id: "p1", value: "  " }],
        "phone"
      )
    ).toBe("Extra phone number cannot be cleared");
  });
});
