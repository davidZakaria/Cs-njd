import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UnitRequestType } from "@prisma/client";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: string) => {
    const t = (key: string, values?: Record<string, string>) => {
      if (values?.type) return `${key}:${values.type}`;
      return `${namespace}.${key}`;
    };
    return t;
  },
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children?: React.ReactNode;
  }) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/actions/official-documents", () => ({
  generateOfficialDocumentAction: vi.fn(),
  getOfficialDocumentTextDraftAction: vi.fn(),
  prepareOfficialDocumentTextDraftAction: vi.fn(),
  saveOfficialDocumentTextDraftAction: vi.fn(),
}));

describe("UnitOfficialDocumentsPanel", () => {
  it("shows empty-state notice and disables edit when no approved request exists", async () => {
    const { UnitOfficialDocumentsPanel } = await import(
      "@/components/units/unit-official-documents-panel"
    );

    const html = renderToString(
      React.createElement(UnitOfficialDocumentsPanel, {
        unitId: "unit-1",
        canEditDraftText: true,
        canViewDraftText: false,
        canGeneratePdf: true,
        canCreateUnitRequest: true,
        generatedDocuments: [],
        textDrafts: [],
        approvedRequests: [],
      })
    );

    expect(html).toContain("noApprovedRequestNotice:");
    expect(html).toContain("createRequestType:");
    expect(html).toContain('href="/requests?unitId=unit-1&amp;type=GRACE_PERIOD_ANNEX"');
    expect(html).toContain("data-disabled");
  });

  it("shows legal guidance instead of create button when user cannot create requests", async () => {
    const { UnitOfficialDocumentsPanel } = await import(
      "@/components/units/unit-official-documents-panel"
    );

    const html = renderToString(
      React.createElement(UnitOfficialDocumentsPanel, {
        unitId: "unit-1",
        canEditDraftText: true,
        canViewDraftText: false,
        canGeneratePdf: true,
        canCreateUnitRequest: false,
        generatedDocuments: [],
        textDrafts: [],
        approvedRequests: [],
      })
    );

    expect(html).toContain("askCsToCreateRequest:");
    expect(html).not.toContain("createRequestType:");
  });

  it("enables edit when a matching approved request is available", async () => {
    const { UnitOfficialDocumentsPanel } = await import(
      "@/components/units/unit-official-documents-panel"
    );

    const html = renderToString(
      React.createElement(UnitOfficialDocumentsPanel, {
        unitId: "unit-1",
        canEditDraftText: true,
        canViewDraftText: false,
        canGeneratePdf: true,
        canCreateUnitRequest: false,
        generatedDocuments: [],
        textDrafts: [],
        approvedRequests: [
          {
            id: "req-1",
            type: UnitRequestType.GRACE_PERIOD_ANNEX,
            status: "APPROVED",
            submittedAt: new Date("2026-01-15T00:00:00.000Z"),
            updatedAt: new Date("2026-01-16T00:00:00.000Z"),
            description: "Grace extension",
          },
        ],
      })
    );

    expect(html).toContain("Grace extension");
    expect(html).toContain("officialDocuments.editText");
    expect(html).not.toContain("noApprovedRequestNotice:");
  });

  it("shows create-request guidance for CS view-only users who can create requests", async () => {
    const { UnitOfficialDocumentsPanel } = await import(
      "@/components/units/unit-official-documents-panel"
    );

    const html = renderToString(
      React.createElement(UnitOfficialDocumentsPanel, {
        unitId: "unit-1",
        canEditDraftText: false,
        canViewDraftText: true,
        canGeneratePdf: false,
        canCreateUnitRequest: true,
        generatedDocuments: [],
        textDrafts: [],
        approvedRequests: [],
      })
    );

    expect(html).toContain("noApprovedRequestNotice:");
    expect(html).toContain("createRequestType:");
    expect(html).not.toContain("officialDocuments.viewOnlyHint");
    expect(html).not.toContain("officialDocuments.editText");
  });
});
