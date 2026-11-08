/**
 * Simulates the production UI path (English locale → forced Arabic masters)
 * and writes PDF + page-1 PNG for each variant under /opt/cursor/artifacts.
 */
import fs from "node:fs";
import path from "node:path";

import { resolveOfficialDocumentTemplateLocale } from "@/lib/official-documents/handover/document-locale";
import { buildOfficialHandoverFieldValues } from "@/lib/official-documents/handover/field-values";
import {
  closeHandoverPdfBrowser,
  renderOfficialHandoverRecordPdf,
  buildOfficialHandoverHtml,
} from "@/lib/official-documents/handover/render-pdf";
import { renderHandoverHtmlPageOnePng } from "@/lib/official-documents/handover/html/chromium-pdf";
import type { HandoverTemplateKey } from "@/lib/print/handover-templates/types";
import type { UnitMergeInput } from "@/lib/official-documents/merge-fields";

const artifactsDir = "/opt/cursor/artifacts/handover-production-flow";

const baseClientFields = {
  phone1: "+201000000001",
  phone2: null as string | null,
  address1: "12 Demo Street",
  address2: null as string | null,
};

function sampleUnit(project: "GREEN AVENUE" | "JURA", dual: boolean): UnitMergeInput {
  const primary = {
    name: "Demo Owner",
    nationalId: "29001011234567",
    email: "demo@example.com",
    ...baseClientFields,
    phones: [{ id: "p1", phone: "+201000000001", sortOrder: 0 }],
    addresses: [{ id: "a1", address: "12 Demo Street", sortOrder: 0 }],
  };
  return {
    unitCode: "762-0-X",
    area: 220,
    gracePeriod: "0",
    contractPricePerMeter: 0,
    swapOutgoingUnitCode: null,
    swapOutgoingProjectName: null,
    swappedFromUnitCode: null,
    swappedFromProjectName: null,
    project: { name: project },
    client: primary,
    unitClients: dual
      ? [
          { role: "PRIMARY", client: primary },
          {
            role: "CO_OWNER",
            client: {
              name: "Demo Co-owner",
              nationalId: "29001019876543",
              email: "co@example.com",
              ...baseClientFields,
              phones: [],
              addresses: [],
            },
          },
        ]
      : [{ role: "PRIMARY", client: primary }],
    contractWorkflow: {
      contractDate: new Date("2025-09-30"),
      deliveryDate: new Date("2026-05-17"),
    },
    finishing:
      project === "JURA"
        ? null
        : {
            finishingType: "FULLY_FINISHED",
            packageType: "PACKAGE_1",
            packageLabel: "Fully Finished",
            totalFinishingPrice: 100,
            pricePerMeter: 1,
            doorFees: null,
            aluminumFees: null,
            contractDate: null,
          },
  };
}

const variants: { key: HandoverTemplateKey; unit: UnitMergeInput }[] = [
  { key: "green-avenue", unit: sampleUnit("GREEN AVENUE", false) },
  {
    key: "green-avenue-no-insurance",
    unit: {
      ...sampleUnit("GREEN AVENUE", false),
      finishing: {
        finishingType: "CORE_AND_SHELL",
        packageType: "CORE_AND_SHELL",
        packageLabel: null,
        totalFinishingPrice: null,
        pricePerMeter: null,
        doorFees: null,
        aluminumFees: null,
        contractDate: null,
      },
    },
  },
  { key: "green-avenue-dual", unit: sampleUnit("GREEN AVENUE", true) },
  {
    key: "green-avenue-dual-no-insurance",
    unit: {
      ...sampleUnit("GREEN AVENUE", true),
      finishing: {
        finishingType: "FULLY_FINISHED",
        packageType: "PACKAGE_1",
        packageLabel: null,
        totalFinishingPrice: 100,
        pricePerMeter: 1,
        doorFees: null,
        aluminumFees: null,
        contractDate: null,
      },
    },
  },
  { key: "jura", unit: sampleUnit("JURA", false) },
  { key: "jura-dual", unit: sampleUnit("JURA", true) },
];

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });

  const forcedLocale = resolveOfficialDocumentTemplateLocale({
    documentType: "HANDOVER_RECORD",
    projectName: "GREEN AVENUE",
    requestedLocale: "en",
  });
  if (forcedLocale !== "ar") {
    throw new Error("Expected English UI to force Arabic handover locale");
  }

  for (const { key, unit } of variants) {
    const { handoverFields } = buildOfficialHandoverFieldValues(unit, "ar");
    const html = buildOfficialHandoverHtml({
      templateKey: key,
      fields: handoverFields,
      watermarkDraft: true,
    });
    const pdf = await renderOfficialHandoverRecordPdf({
      templateKey: key,
      fields: handoverFields,
      watermarkDraft: true,
    });
    const png = await renderHandoverHtmlPageOnePng(html);

    fs.writeFileSync(path.join(artifactsDir, `${key}.pdf`), pdf);
    fs.writeFileSync(path.join(artifactsDir, `${key}-page1.png`), png);
    console.log("Wrote", key);
  }

  await closeHandoverPdfBrowser();
  console.log("Artifacts:", artifactsDir);
}

main().catch(async (err) => {
  console.error(err);
  await closeHandoverPdfBrowser();
  process.exit(1);
});
