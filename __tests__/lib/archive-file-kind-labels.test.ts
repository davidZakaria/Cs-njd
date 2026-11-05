import { describe, expect, it } from "vitest";

import { ARCHIVE_FILE_KIND_BILINGUAL } from "@/lib/archive-file-request/kind-labels";

describe("archive file kind notification labels", () => {
  it("uses human-readable bilingual labels not enum keys", () => {
    expect(ARCHIVE_FILE_KIND_BILINGUAL.NATIONAL_ID.en).toBe("National ID");
    expect(ARCHIVE_FILE_KIND_BILINGUAL.NATIONAL_ID.ar).toBe("بطاقة الرقم القومي");
    expect(ARCHIVE_FILE_KIND_BILINGUAL.CONTRACT.en).not.toMatch(/CONTRACT/);
  });
});
