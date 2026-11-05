import fs from "node:fs";
import path from "node:path";

import { buildOfficialHandoverFieldValues } from "@/lib/official-documents/handover/field-values";
import {
  buildOfficialHandoverHtml,
  closeHandoverPdfBrowser,
  renderHandoverHtmlPageOnePng,
  renderHandoverHtmlToPdf,
  renderPdfBufferToPngPages,
} from "@/lib/official-documents/handover/render-pdf";
import type { HandoverTemplateKey } from "@/lib/print/handover-templates/types";
import type { UnitMergeInput } from "@/lib/official-documents/merge-fields";

const outDir = path.join(process.cwd(), "docs/official-documents-samples/handover-masters");
const artifactsDir = path.join(process.cwd(), "/opt/cursor/artifacts/handover-samples");

const baseClientFields = {
  phone1: "+201012345678",
  phone2: "+201011122233",
  address1: "12 Sample Street, Cairo",
  address2: null as string | null,
};

const sampleUnit: UnitMergeInput = {
  unitCode: "205-7-A",
  area: 145,
  gracePeriod: null,
  contractPricePerMeter: null,
  swapOutgoingUnitCode: null,
  swapOutgoingProjectName: null,
  swappedFromUnitCode: null,
  swappedFromProjectName: null,
  project: { name: "GREEN AVENUE" },
  client: {
    name: "Sample Owner One",
    nationalId: "29001011234567",
    email: "owner1@example.com",
    ...baseClientFields,
    phones: [
      { id: "p1", phone: "+201012345678", sortOrder: 0 },
      { id: "p1b", phone: "+201011122233", sortOrder: 1 },
    ],
    addresses: [{ id: "a1", address: "12 Sample Street, Cairo", sortOrder: 0 }],
  },
  unitClients: [
    {
      role: "PRIMARY",
      client: {
        name: "Sample Owner One",
        nationalId: "29001011234567",
        email: "owner1@example.com",
        ...baseClientFields,
        phones: [
          { id: "p1", phone: "+201012345678", sortOrder: 0 },
          { id: "p1b", phone: "+201011122233", sortOrder: 1 },
        ],
        addresses: [
          { id: "a1", address: "12 Sample Street, Cairo", sortOrder: 0 },
        ],
      },
    },
    {
      role: "CO_OWNER",
      client: {
        name: "Sample Owner Two",
        nationalId: "29001019876543",
        email: "owner2@example.com",
        phone1: "+201098765432",
        phone2: "+201055566677",
        address1: "34 Co-owner Street, Giza",
        address2: null,
        phones: [
          { id: "p2", phone: "+201098765432", sortOrder: 0 },
          { id: "p2b", phone: "+201055566677", sortOrder: 1 },
        ],
        addresses: [
          { id: "a2", address: "34 Co-owner Street, Giza", sortOrder: 0 },
        ],
      },
    },
  ],
  contractWorkflow: {
    contractDate: new Date("2024-03-10"),
    deliveryDate: new Date("2026-05-17"),
  },
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
};

const variants: { key: HandoverTemplateKey; unit: UnitMergeInput }[] = [
  {
    key: "green-avenue",
    unit: { ...sampleUnit, unitClients: [sampleUnit.unitClients[0]!] },
  },
  {
    key: "green-avenue-no-insurance",
    unit: {
      ...sampleUnit,
      unitClients: [sampleUnit.unitClients[0]!],
      finishing: {
        ...sampleUnit.finishing!,
        finishingType: "FULLY_FINISHED",
        packageType: "PACKAGE_1",
      },
    },
  },
  { key: "green-avenue-dual", unit: sampleUnit },
  {
    key: "green-avenue-dual-no-insurance",
    unit: {
      ...sampleUnit,
      finishing: {
        ...sampleUnit.finishing!,
        finishingType: "FULLY_FINISHED",
        packageType: "PACKAGE_1",
      },
    },
  },
  {
    key: "jura",
    unit: {
      ...sampleUnit,
      project: { name: "JURA" },
      unitClients: [sampleUnit.unitClients[0]!],
      finishing: null,
    },
  },
  {
    key: "jura-dual",
    unit: {
      ...sampleUnit,
      project: { name: "JURA" },
      finishing: null,
    },
  },
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(artifactsDir, { recursive: true });

  for (const { key, unit } of variants) {
    const { handoverFields } = buildOfficialHandoverFieldValues(unit, "ar");
    const html = buildOfficialHandoverHtml({
      templateKey: key,
      fields: handoverFields,
      watermarkDraft: true,
    });
    const pdf = await renderHandoverHtmlToPdf(html);
    const pngPage1 = await renderHandoverHtmlPageOnePng(html);

    const pdfName = `${key}.pdf`;
    const pngName = `${key}-page1.png`;
    const pdfPath = path.join(outDir, pdfName);
    fs.writeFileSync(pdfPath, pdf);
    fs.writeFileSync(path.join(outDir, pngName), pngPage1);
    fs.writeFileSync(path.join(artifactsDir, pdfName), pdf);
    fs.writeFileSync(path.join(artifactsDir, pngName), pngPage1);

    const pagePngs = renderPdfBufferToPngPages(pdf, artifactsDir, `${key}-page`);
    for (const pagePath of pagePngs) {
      const base = path.basename(pagePath);
      fs.copyFileSync(pagePath, path.join(outDir, base));
      fs.copyFileSync(pagePath, path.join(artifactsDir, base));
    }

    console.log("Wrote", pdfName, pngName, `+ ${pagePngs.length} page PNG(s)`);
  }

  await closeHandoverPdfBrowser();
}

main().catch(async (err) => {
  console.error(err);
  await closeHandoverPdfBrowser();
  process.exit(1);
});
