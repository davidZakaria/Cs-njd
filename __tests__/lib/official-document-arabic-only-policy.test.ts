import { describe, expect, it } from "vitest";

import { OFFICIAL_DOCUMENT_TYPES } from "@/lib/official-documents/types";
import {
  OFFICIAL_GENERATED_DOCUMENT_LOCALE,
  resolveOfficialDocumentTemplateLocale,
} from "@/lib/official-documents/handover/document-locale";

describe("official document Arabic-only generation policy", () => {
  for (const documentType of OFFICIAL_DOCUMENT_TYPES) {
    it(`forces Arabic template locale for ${documentType} even when UI locale is English`, () => {
      expect(
        resolveOfficialDocumentTemplateLocale({
          documentType,
          projectName: "GREEN AVENUE",
          requestedLocale: "en",
        })
      ).toBe(OFFICIAL_GENERATED_DOCUMENT_LOCALE);
      expect(
        resolveOfficialDocumentTemplateLocale({
          documentType,
          projectName: "OTHER PROJECT",
          requestedLocale: "en",
        })
      ).toBe("ar");
    });
  }
});
