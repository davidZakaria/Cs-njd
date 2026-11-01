import { describe, expect, it } from "vitest";

import {
  CONTRACT_UNIT_UPDATE_FLAG,
} from "@/lib/units/contract-unit-update-flags";
import {
  contractFlagsNeedUpdate,
  deriveLegalDocumentUiStatus,
} from "@/lib/units/legal-document-ui-status";

describe("deriveLegalDocumentUiStatus", () => {
  it("prioritizes needs update over file and checkbox", () => {
    expect(
      deriveLegalDocumentUiStatus({
        paperSigned: true,
        hasFile: true,
        needsUpdate: true,
      })
    ).toBe("needs_update");
  });

  it("treats uploaded file as file_uploaded", () => {
    expect(
      deriveLegalDocumentUiStatus({
        paperSigned: false,
        hasFile: true,
        needsUpdate: false,
      })
    ).toBe("file_uploaded");
  });

  it("treats paper-only checkbox as signed_no_file", () => {
    expect(
      deriveLegalDocumentUiStatus({
        paperSigned: true,
        hasFile: false,
        needsUpdate: false,
      })
    ).toBe("signed_no_file");
  });

  it("returns missing when nothing is set", () => {
    expect(
      deriveLegalDocumentUiStatus({
        paperSigned: false,
        hasFile: false,
        needsUpdate: false,
      })
    ).toBe("missing");
  });
});

describe("contractFlagsNeedUpdate", () => {
  it("matches when any listed flag is present", () => {
    expect(
      contractFlagsNeedUpdate(
        [CONTRACT_UNIT_UPDATE_FLAG.preliminary],
        [CONTRACT_UNIT_UPDATE_FLAG.preliminary]
      )
    ).toBe(true);
    expect(
      contractFlagsNeedUpdate(
        [CONTRACT_UNIT_UPDATE_FLAG.saleAnnex],
        [
          CONTRACT_UNIT_UPDATE_FLAG.saleAnnex,
          CONTRACT_UNIT_UPDATE_FLAG.gracePeriodAnnex,
        ]
      )
    ).toBe(true);
  });
});
