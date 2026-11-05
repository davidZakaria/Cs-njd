import { describe, expect, it } from "vitest";

import {
  requestCountsAsOpenArchiveCheckOnUnit,
  unitIdsWithOpenArchiveChecks,
} from "@/lib/archive-check/open-request";

describe("open archive check guards", () => {
  it("counts single and child checks on a unit but not bulk parents", () => {
    expect(
      requestCountsAsOpenArchiveCheckOnUnit({
        type: "ARCHIVE_CHECK",
        status: "PENDING",
        unitId: "unit-1",
        bulkProjectId: null,
        parentRequestId: null,
      })
    ).toBe(true);

    expect(
      requestCountsAsOpenArchiveCheckOnUnit({
        type: "ARCHIVE_CHECK",
        status: "PENDING",
        unitId: "unit-2",
        bulkProjectId: "proj-1",
        parentRequestId: "parent-1",
      })
    ).toBe(true);

    expect(
      requestCountsAsOpenArchiveCheckOnUnit({
        type: "ARCHIVE_CHECK",
        status: "PENDING",
        unitId: null,
        bulkProjectId: "proj-1",
        parentRequestId: null,
      })
    ).toBe(false);

    expect(
      requestCountsAsOpenArchiveCheckOnUnit({
        type: "ARCHIVE_CHECK",
        status: "APPROVED",
        unitId: "unit-1",
        bulkProjectId: null,
        parentRequestId: null,
      })
    ).toBe(false);
  });

  it("collects unit ids from open-check rows for bulk skip logic", () => {
    expect(
      unitIdsWithOpenArchiveChecks([
        { unitId: "u1" },
        { unitId: "u2" },
        { unitId: null },
        { unitId: "u1" },
      ])
    ).toEqual(new Set(["u1", "u2"]));
  });
});
