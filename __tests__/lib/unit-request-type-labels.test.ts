import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function loadMessages(locale: "en" | "ar") {
  const file = path.join(process.cwd(), "messages", `${locale}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as {
    enums: { unitRequestType: Record<string, string> };
    requests: { create: Record<string, string> };
    archiveCheck: { operations: { queueTitle: string } };
    operationsArchiveFileRequests: { pageTitle: string };
  };
}

describe("archive request type user-facing labels", () => {
  it("uses distinct EN labels for ARCHIVE_CHECK vs ARCHIVE_FILE_REQUEST", () => {
    const en = loadMessages("en");
    expect(en.enums.unitRequestType.ARCHIVE_CHECK).toBe("Contract papers check");
    expect(en.enums.unitRequestType.ARCHIVE_FILE_REQUEST).toBe(
      "Request scanned copies"
    );
    expect(en.requests.create.typeHintArchiveCheck).toMatch(/contract papers/i);
    expect(en.requests.create.typeHintArchiveFileRequest).toMatch(/scans/i);
    expect(en.archiveCheck.operations.queueTitle).toBe(
      "Contract papers checks awaiting operations"
    );
    expect(en.operationsArchiveFileRequests.pageTitle).toBe("Scanned copy requests");
  });

  it("uses distinct AR labels for ARCHIVE_CHECK vs ARCHIVE_FILE_REQUEST", () => {
    const ar = loadMessages("ar");
    expect(ar.enums.unitRequestType.ARCHIVE_CHECK).toBe("مراجعة أوراق العقد");
    expect(ar.enums.unitRequestType.ARCHIVE_FILE_REQUEST).toBe(
      "طلب نسخ ممسوحة من الأرشيف"
    );
    expect(ar.requests.create.typeHintArchiveCheck).toMatch(/أوراق عقد/);
    expect(ar.requests.create.typeHintArchiveFileRequest).toMatch(/مسوح/);
    expect(ar.archiveCheck.operations.queueTitle).toBe(
      "مراجعات أوراق العقد بانتظار العمليات"
    );
    expect(ar.operationsArchiveFileRequests.pageTitle).toBe("طلبات النسخ الممسوحة");
  });
});