import { describe, expect, it } from "vitest";
import { UnitRequestType } from "@prisma/client";

import {
  buildPrefilledCreateUnitRequestHref,
  canEditOfficialDocumentDraftNow,
  filterApprovedRequestsForDocumentType,
  formatApprovedUnitRequestOptionLabel,
  resolveAutoLinkedUnitRequestId,
  summarizeUnitRequestDescription,
} from "@/lib/official-documents/approved-request-option";

describe("approved-request-option helpers", () => {
  it("formats readable request labels with date and summary", () => {
    const label = formatApprovedUnitRequestOptionLabel({
      typeLabel: "Grace period annex",
      submittedAt: new Date("2026-03-01T12:00:00.000Z"),
      updatedAt: new Date("2026-03-02T12:00:00.000Z"),
      description: "  Extend grace period\nfor client  ",
      locale: "en",
    });

    expect(label).toContain("Grace period annex");
    expect(label).toContain("Mar");
    expect(label).toContain("Extend grace period for client");
    expect(label).not.toContain("req_");
  });

  it("truncates long summaries", () => {
    const long = "a".repeat(60);
    expect(summarizeUnitRequestDescription(long).endsWith("…")).toBe(true);
  });

  it("filters approved requests by required type", () => {
    const rows = [
      { id: "1", type: UnitRequestType.GRACE_PERIOD_ANNEX },
      { id: "2", type: UnitRequestType.UNIT_SWAP },
    ];
    expect(
      filterApprovedRequestsForDocumentType(rows, UnitRequestType.GRACE_PERIOD_ANNEX)
    ).toEqual([{ id: "1", type: UnitRequestType.GRACE_PERIOD_ANNEX }]);
  });

  it("auto-selects a single matching request and clears stale selections", () => {
    expect(
      resolveAutoLinkedUnitRequestId({
        needsRequest: true,
        requestOptions: [{ id: "only" }],
        unitRequestId: "",
      })
    ).toBe("only");

    expect(
      resolveAutoLinkedUnitRequestId({
        needsRequest: true,
        requestOptions: [{ id: "only" }],
        unitRequestId: "only",
      })
    ).toBeUndefined();

    expect(
      resolveAutoLinkedUnitRequestId({
        needsRequest: true,
        requestOptions: [],
        unitRequestId: "stale",
      })
    ).toBe("");

    expect(
      resolveAutoLinkedUnitRequestId({
        needsRequest: true,
        requestOptions: [{ id: "a" }, { id: "b" }],
        unitRequestId: "missing",
      })
    ).toBe("");
  });

  it("blocks edit until a linked request is chosen when required", () => {
    expect(canEditOfficialDocumentDraftNow({ needsRequest: true, unitRequestId: "" })).toBe(
      false
    );
    expect(
      canEditOfficialDocumentDraftNow({ needsRequest: true, unitRequestId: "req-1" })
    ).toBe(true);
    expect(canEditOfficialDocumentDraftNow({ needsRequest: false, unitRequestId: "" })).toBe(
      true
    );
  });

  it("builds create-request links with unit and type", () => {
    expect(
      buildPrefilledCreateUnitRequestHref({
        unitId: "unit-1",
        requestType: UnitRequestType.GRACE_PERIOD_ANNEX,
      })
    ).toBe("/requests?unitId=unit-1&type=GRACE_PERIOD_ANNEX");
  });
});
