import { describe, expect, it } from "vitest";

import { getApprovalPathForType } from "@/lib/requests/approval-paths";
import { unitCycleStageForRequestType } from "@/lib/requests/stage-mapping";
import { requestBlocksUnitCycleStage } from "@/lib/unit-cycle/stage-request-blocking";
import { sortInboxRowsForDisplay } from "@/lib/archive-file-request/queries";
import { fulfillmentLinkForArchiveFileItem } from "@/lib/archive-file-request/links";

describe("ARCHIVE_FILE_REQUEST workflow", () => {
  it("routes to operations only", () => {
    expect(getApprovalPathForType("ARCHIVE_FILE_REQUEST")).toEqual(["OPERATIONS"]);
  });

  it("does not map to a unit cycle stage", () => {
    expect(unitCycleStageForRequestType("ARCHIVE_FILE_REQUEST")).toBeNull();
  });

  it("does not block unit cycle stages when pending", () => {
    expect(
      requestBlocksUnitCycleStage({
        unitCycleEnabled: true,
        stageKey: "FINANCE",
        request: {
          status: "PENDING",
          type: "ARCHIVE_FILE_REQUEST",
          unitCycleStageKey: null,
        },
      })
    ).toBe(false);
  });
});

describe("operations archive file inbox sorting", () => {
  it("pins urgent requests above normal with newest first", () => {
    const sorted = sortInboxRowsForDisplay([
      {
        archiveFilePriority: "NORMAL",
        submittedAt: new Date("2026-11-05T12:00:00Z"),
        createdAt: new Date("2026-11-05T12:00:00Z"),
      },
      {
        archiveFilePriority: "URGENT",
        submittedAt: new Date("2026-11-05T10:00:00Z"),
        createdAt: new Date("2026-11-05T10:00:00Z"),
      },
      {
        archiveFilePriority: "URGENT",
        submittedAt: new Date("2026-11-05T11:00:00Z"),
        createdAt: new Date("2026-11-05T11:00:00Z"),
      },
    ]);

    expect(sorted[0].submittedAt?.toISOString()).toBe("2026-11-05T11:00:00.000Z");
    expect(sorted[1].submittedAt?.toISOString()).toBe("2026-11-05T10:00:00.000Z");
    expect(sorted[2].archiveFilePriority).toBe("NORMAL");
  });
});

describe("archive file fulfillment links", () => {
  it("builds document API links by kind", () => {
    expect(
      fulfillmentLinkForArchiveFileItem({
        unitId: "u1",
        requestId: "r1",
        fileKind: "CONTRACT",
      })
    ).toBe("/api/units/u1/signed-contract");

    expect(
      fulfillmentLinkForArchiveFileItem({
        unitId: "u1",
        requestId: "r1",
        fileKind: "OTHER",
        attachmentId: "a1",
      })
    ).toBe("/api/unit-requests/r1/attachments/a1");
  });
});
