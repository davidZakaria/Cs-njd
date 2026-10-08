import { describe, expect, it } from "vitest";
import { applyDhlSiteVisitLock } from "@/lib/workflow/handover-dhl-gate";

const existing = {
  siteVisitDone: false,
  dhlSentToClient: true,
  dhlSentToClientDate: new Date("2024-01-15"),
  dhlReceivedFromClient: false,
  dhlReceivedFromClientDate: null,
  powerOfAttorneyReceived: true,
};

describe("applyDhlSiteVisitLock", () => {
  it("allows DHL updates when site visit is done", () => {
    const proposed = {
      siteVisitDone: true,
      dhlSentToClient: true,
      dhlSentToClientDate: new Date("2024-02-01"),
      dhlReceivedFromClient: true,
      dhlReceivedFromClientDate: new Date("2024-02-10"),
      powerOfAttorneyReceived: true,
    };

    expect(applyDhlSiteVisitLock(proposed, existing)).toEqual(proposed);
  });

  it("reverts DHL field changes when site visit is not done", () => {
    const proposed = {
      siteVisitDone: false,
      dhlSentToClient: true,
      dhlSentToClientDate: new Date("2024-03-01"),
      dhlReceivedFromClient: true,
      dhlReceivedFromClientDate: new Date("2024-03-02"),
      powerOfAttorneyReceived: true,
    };

    expect(applyDhlSiteVisitLock(proposed, existing)).toMatchObject({
      siteVisitDone: false,
      dhlSentToClient: true,
      dhlReceivedFromClient: false,
      powerOfAttorneyReceived: true,
    });
  });

  it("allows unticking site visit while preserving stored DHL values", () => {
    const wasDone = {
      siteVisitDone: true,
      dhlSentToClient: true,
      dhlSentToClientDate: new Date("2024-05-01"),
      dhlReceivedFromClient: true,
      dhlReceivedFromClientDate: new Date("2024-05-10"),
      powerOfAttorneyReceived: true,
    };

    const proposed = {
      siteVisitDone: false,
      dhlSentToClient: true,
      dhlSentToClientDate: new Date("2024-05-01"),
      dhlReceivedFromClient: true,
      dhlReceivedFromClientDate: new Date("2024-05-10"),
      powerOfAttorneyReceived: true,
    };

    expect(applyDhlSiteVisitLock(proposed, wasDone)).toMatchObject({
      siteVisitDone: false,
      dhlSentToClient: true,
      dhlReceivedFromClient: true,
      powerOfAttorneyReceived: true,
    });
  });

  it("clears DHL fields when no existing row and site visit not done", () => {
    const proposed = {
      siteVisitDone: false,
      dhlSentToClient: true,
      dhlSentToClientDate: new Date("2024-03-01"),
      dhlReceivedFromClient: true,
      dhlReceivedFromClientDate: new Date("2024-03-02"),
      powerOfAttorneyReceived: true,
    };

    expect(applyDhlSiteVisitLock(proposed, null)).toMatchObject({
      siteVisitDone: false,
      dhlSentToClient: false,
      dhlReceivedFromClient: false,
      powerOfAttorneyReceived: false,
      dhlSentToClientDate: null,
      dhlReceivedFromClientDate: null,
    });
  });
});
