import { describe, expect, it } from "vitest";

import {
  canAccessCsPortfolioDocuments,
  canViewUnitPortfolioDocuments,
} from "@/lib/auth/cs-portfolio-document-access";

describe("unit portfolio document viewing", () => {
  it("lets legal and finance view without upload portfolio access", () => {
    expect(canViewUnitPortfolioDocuments("LEGAL")).toBe(true);
    expect(canViewUnitPortfolioDocuments("FINANCE")).toBe(true);
    expect(canAccessCsPortfolioDocuments("LEGAL")).toBe(false);
    expect(canAccessCsPortfolioDocuments("FINANCE")).toBe(false);
  });
});
