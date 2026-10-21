import { describe, expect, it } from "vitest";

import { validateCsClientIdentityUpdate } from "@/lib/clients/cs-identity-guard";

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
});
