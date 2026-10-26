import { describe, expect, it } from "vitest";

import {
  canAccessCsPortfolioDocuments,
  canManageCsPortfolioDocumentFiles,
} from "@/lib/auth/cs-portfolio-document-access";

describe("cs-portfolio-document-access", () => {
  it("allows CS agents to access portfolio documents on any unit", () => {
    expect(canAccessCsPortfolioDocuments("CS_AGENT")).toBe(true);
    expect(canManageCsPortfolioDocumentFiles("CS_AGENT")).toBe(false);
  });

  it("allows management to manage files", () => {
    expect(canAccessCsPortfolioDocuments("MANAGEMENT")).toBe(true);
    expect(canManageCsPortfolioDocumentFiles("MANAGEMENT")).toBe(true);
  });

  it("denies engineers", () => {
    expect(canAccessCsPortfolioDocuments("ENGINEER")).toBe(false);
  });
});
