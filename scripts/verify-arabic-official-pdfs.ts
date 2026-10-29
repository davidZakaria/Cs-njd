import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { DEFAULT_OFFICIAL_DOCUMENT_TEMPLATES } from "@/lib/official-documents/default-templates";
import { buildOfficialDocumentMergeFields } from "@/lib/official-documents/merge-fields";
import { renderOfficialDocumentPdf } from "@/lib/official-documents/render-pdf";

const execFileAsync = promisify(execFile);

const sampleUnit = {
  unitCode: "101-3-B",
  area: 120,
  gracePeriod: "٦ أشهر",
  contractPricePerMeter: 45000,
  swapOutgoingUnitCode: null,
  swapOutgoingProjectName: null,
  swappedFromUnitCode: null,
  swappedFromProjectName: null,
  project: { name: "GREEN AVENUE" },
  client: {
    name: "أحمد علي",
    nationalId: "123",
    email: "a@example.com",
    phone1: null,
    phone2: null,
    address1: "القاهرة",
    address2: null,
    phones: [],
    addresses: [],
  },
  unitClients: [
    {
      role: "PRIMARY",
      client: {
        name: "أحمد علي",
        nationalId: "123",
        email: "a@example.com",
        phone1: "+20100000000",
        phone2: null,
        address1: "القاهرة",
        address2: null,
        phones: [{ id: "p1", phone: "+20100000000", sortOrder: 0 }],
        addresses: [{ id: "a1", address: "القاهرة", sortOrder: 0 }],
      },
    },
  ],
  contractWorkflow: {
    contractDate: new Date("2024-01-15"),
    deliveryDate: new Date("2026-06-01"),
  },
  finishing: null,
};

async function main() {
  const outDir = path.join(process.cwd(), "docs/official-documents-samples");
  await fs.mkdir(outDir, { recursive: true });

  const fields = buildOfficialDocumentMergeFields(sampleUnit, "ar", {
    requestDescription: "تمديد فترة السماح",
    issuedAt: new Date("2026-10-29T12:00:00Z"),
  });

  const specs = [
    {
      key: "grace-period-annex-ar",
      template: DEFAULT_OFFICIAL_DOCUMENT_TEMPLATES.find(
        (t) => t.documentType === "GRACE_PERIOD_ANNEX" && t.locale === "ar"
      )!,
    },
    {
      key: "handover-record-ar",
      template: DEFAULT_OFFICIAL_DOCUMENT_TEMPLATES.find(
        (t) => t.documentType === "HANDOVER_RECORD" && t.locale === "ar"
      )!,
    },
  ];

  for (const spec of specs) {
    const pdfBytes = await renderOfficialDocumentPdf({
      title: spec.template.title,
      bodyTemplate: spec.template.body,
      fields,
      locale: "ar",
      watermarkDraft: true,
    });
    const pdfPath = path.join(outDir, `${spec.key}.pdf`);
    await fs.writeFile(pdfPath, pdfBytes);
    const pngPrefix = path.join(outDir, spec.key);
    await execFileAsync("pdftoppm", ["-png", "-f", "1", "-l", "1", pdfPath, pngPrefix]);
    console.log(`Wrote ${pdfPath} and ${pngPrefix}-1.png`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
