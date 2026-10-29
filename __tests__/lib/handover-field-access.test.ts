import { describe, expect, it } from "vitest";

import {
  canEditHandoverChecklistField,
  showManagementOnlyHint,
} from "@/lib/workflow/handover-field-access";

describe("handover field access", () => {
  it("lets CS agents edit sale annex and handover record on assigned units", () => {
    expect(
      canEditHandoverChecklistField("hasSignedExtension", false, true)
    ).toBe(true);
    expect(
      canEditHandoverChecklistField("hasSignedProtocol", false, true)
    ).toBe(true);
    expect(
      canEditHandoverChecklistField("signedExtensionDate", false, true)
    ).toBe(true);
  });

  it("keeps delivery workflow fields view-only for CS with management hint", () => {
    expect(
      canEditHandoverChecklistField("handoverStatus", false, true)
    ).toBe(false);
    expect(
      canEditHandoverChecklistField("contractDate", false, true)
    ).toBe(false);
    expect(
      canEditHandoverChecklistField("hasPreliminarySaleContract", false, true)
    ).toBe(false);
    expect(
      canEditHandoverChecklistField("hasFinalSaleContract", false, true)
    ).toBe(false);

    expect(
      showManagementOnlyHint("deliveryDate", false, true)
    ).toBe(true);
    expect(
      showManagementOnlyHint("hasSignedExtension", false, true)
    ).toBe(false);
  });

  it("allows CS engineering site visit approval without assignment", () => {
    expect(
      canEditHandoverChecklistField("siteVisitDone", false, false, true)
    ).toBe(true);
    expect(
      canEditHandoverChecklistField("hasSignedProtocol", false, false, true)
    ).toBe(false);
  });

  it("allows management full edit", () => {
    expect(
      canEditHandoverChecklistField("handoverStatus", true, false)
    ).toBe(true);
    expect(showManagementOnlyHint("handoverStatus", true, true)).toBe(false);
  });
});
