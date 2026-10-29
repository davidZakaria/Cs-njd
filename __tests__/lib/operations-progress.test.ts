import { describe, expect, it } from "vitest";
import {
  computeOperationsProgress,
  isGracePeriodAnnexApplicable,
  isFinishingTrackApplicable,
  OPERATIONS_PROGRESS_ITEM,
  statusCoOwnerIds,
  statusFinishingContract,
  statusFinishingFinancials,
  statusGracePeriodAnnex,
  statusHandoverRecord,
  statusPaperHandoverChecks,
  statusPreliminaryContract,
  type OperationsProgressInput,
} from "@/lib/operations/operations-progress";
import { CONTRACT_UNIT_UPDATE_FLAG } from "@/lib/units/contract-unit-update-flags";

function baseInput(
  overrides: Partial<OperationsProgressInput> = {}
): OperationsProgressInput {
  return {
    gracePeriod: null,
    unitArea: 120,
    owners: [{ role: "PRIMARY", nationalIdFile: "id.pdf" }],
    workflow: {
      handoverStatus: "PENDING",
      hasPreliminarySaleContract: false,
      hasFinalSaleContract: false,
      hasSignedExtension: false,
      hasSignedProtocol: false,
      signedContractFile: null,
      extensionAnnexFile: null,
      signedProtocolStoredName: null,
      papersReceived: false,
      siteVisitDone: false,
      paperHandoverPreliminaryCopy: false,
      paperHandoverOriginalProtocol: false,
      paperHandoverFinishingPapers: false,
      paperHandoverKeyReceived: false,
      contractUnitUpdateFlags: [],
    },
    finishing: null,
    ...overrides,
  };
}

describe("operations progress rules", () => {
  it("marks primary owner ID missing without upload", () => {
    const input = baseInput({
      owners: [{ role: "PRIMARY", nationalIdFile: null }],
    });
    expect(
      computeOperationsProgress(input).items.find(
        (i) => i.key === OPERATIONS_PROGRESS_ITEM.primaryOwnerId
      )?.status
    ).toBe("missing");
  });

  it("marks co-owner IDs not applicable when there are no co-owners", () => {
    expect(statusCoOwnerIds(baseInput())).toBe("not_applicable");
  });

  it("marks co-owner IDs missing when any co-owner lacks a scan", () => {
    const input = baseInput({
      owners: [
        { role: "PRIMARY", nationalIdFile: "p.pdf" },
        { role: "CO_OWNER", nationalIdFile: null },
      ],
    });
    expect(statusCoOwnerIds(input)).toBe("missing");
  });

  it("flags preliminary contract as needs update after unit swap", () => {
    const input = baseInput({
      workflow: {
        ...baseInput().workflow!,
        signedContractFile: "old.pdf",
        contractUnitUpdateFlags: [CONTRACT_UNIT_UPDATE_FLAG.preliminary],
      },
    });
    expect(statusPreliminaryContract(input)).toBe("needs_update");
  });

  it("marks handover record done when signed protocol file exists", () => {
    const input = baseInput({
      workflow: {
        ...baseInput().workflow!,
        signedProtocolStoredName: "protocol.pdf",
      },
    });
    expect(statusHandoverRecord(input)).toBe("done");
  });

  it("marks grace period annex not applicable without grace context", () => {
    expect(isGracePeriodAnnexApplicable(baseInput())).toBe(false);
    expect(statusGracePeriodAnnex(baseInput())).toBe("not_applicable");
  });

  it("marks grace period annex missing when applicable but no file", () => {
    const input = baseInput({ gracePeriod: "6 months" });
    expect(isGracePeriodAnnexApplicable(input)).toBe(true);
    expect(statusGracePeriodAnnex(input)).toBe("missing");
  });

  it("marks finishing contract needs update from finishing flag", () => {
    const input = baseInput({
      finishing: {
        packageType: "FULL",
        finishingContractFile: "f.pdf",
        finishingContractNeedsUnitUpdate: true,
        totalFinishingPrice: 500_000,
        doorFees: 25_000,
        aluminumFees: 0,
        pricePerMeter: 4000,
      },
    });
    expect(isFinishingTrackApplicable(input)).toBe(true);
    expect(statusFinishingContract(input)).toBe("needs_update");
  });

  it("marks finishing financials missing when totals fail quality checks", () => {
    const input = baseInput({
      finishing: {
        packageType: "FULL",
        finishingContractFile: null,
        finishingContractNeedsUnitUpdate: false,
        totalFinishingPrice: 100,
        doorFees: 0,
        aluminumFees: 0,
        pricePerMeter: null,
      },
    });
    expect(statusFinishingFinancials(input)).toBe("missing");
  });

  it("marks paper handover done only when all checks are true", () => {
    const partial = baseInput({
      workflow: {
        ...baseInput().workflow!,
        paperHandoverPreliminaryCopy: true,
        paperHandoverOriginalProtocol: true,
        paperHandoverFinishingPapers: true,
        paperHandoverKeyReceived: false,
      },
    });
    expect(statusPaperHandoverChecks(partial)).toBe("missing");

    const complete = baseInput({
      workflow: {
        ...baseInput().workflow!,
        paperHandoverPreliminaryCopy: true,
        paperHandoverOriginalProtocol: true,
        paperHandoverFinishingPapers: true,
        paperHandoverKeyReceived: true,
      },
    });
    expect(statusPaperHandoverChecks(complete)).toBe("done");
  });

  it("excludes not-applicable items from progress denominator", () => {
    const summary = computeOperationsProgress(baseInput());
    expect(summary.applicableCount).toBeGreaterThan(0);
    expect(summary.doneCount).toBeLessThanOrEqual(summary.applicableCount);
    const naCount = summary.items.filter((i) => i.status === "not_applicable")
      .length;
    expect(summary.applicableCount).toBe(summary.items.length - naCount);
  });
});
