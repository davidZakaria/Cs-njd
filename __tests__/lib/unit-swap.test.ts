import { describe, expect, it } from "vitest";

import {
  computeContractUpdateFlagsFromWorkflow,
  CONTRACT_UNIT_UPDATE_FLAG,
} from "@/lib/units/contract-unit-update-flags";
import { assertTargetUnitEmpty } from "@/lib/units/unit-swap";

describe("unit-swap", () => {
  it("blocks target units that already have a primary client", () => {
    const message = assertTargetUnitEmpty({
      id: "u1",
      clientId: "c1",
      unitClients: [],
    } as never);
    expect(message).toContain("primary client");
  });

  it("blocks target units with co-owners", () => {
    const message = assertTargetUnitEmpty({
      id: "u1",
      clientId: null,
      unitClients: [{ id: "l1" }],
    } as never);
    expect(message).toContain("owners");
  });

  it("computes contract flags from workflow and finishing files", () => {
    const { contractFlags, finishingNeedsUpdate } =
      computeContractUpdateFlagsFromWorkflow(
        {
          hasPreliminarySaleContract: true,
          hasSignedExtension: true,
          extensionAnnexFile: "a.pdf",
          hasSignedProtocol: false,
          signedProtocolStoredName: "p.pdf",
          hasFinalSaleContract: true,
          signedContractFile: "s.pdf",
        },
        { finishingContractFile: "f.pdf" }
      );
    expect(contractFlags).toContain(CONTRACT_UNIT_UPDATE_FLAG.preliminary);
    expect(contractFlags).toContain(CONTRACT_UNIT_UPDATE_FLAG.gracePeriodAnnex);
    expect(contractFlags).toContain(CONTRACT_UNIT_UPDATE_FLAG.handoverRecord);
    expect(finishingNeedsUpdate).toBe(true);
  });
});
