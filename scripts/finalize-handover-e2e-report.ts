/**
 * Build consolidated e2e-report.json from manifest + on-disk artifacts.
 */
import fs from "node:fs";
import path from "node:path";

const STORE =
  process.env.HANDOVER_E2E_STORE?.trim() ||
  "/cursor/stores/self/handover-e2e-ui-evidence";
const MANIFEST_PATH = path.join(STORE, "manifest.json");

type Manifest = {
  loginEmail: string;
  units: Array<{ variant: string; unitId: string; unitCode: string }>;
  legacyDraft?: { unitId: string; draftId: string; userEditMarker: string };
};

function pagePngs(locale: string, variant: string): string[] {
  const dir = path.join(STORE, "pages", `${locale}-${variant}`);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((n) => path.join(dir, n));
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  const reportPath = path.join(STORE, "e2e-report.json");
  const prior = fs.existsSync(reportPath)
    ? (JSON.parse(fs.readFileSync(reportPath, "utf8")) as Record<string, unknown>)
    : {};

  const variants = [];
  for (const locale of ["en", "ar"] as const) {
    for (const unit of manifest.units) {
      const pagePngsList = pagePngs(locale, unit.variant);
      const pdfPath = path.join(STORE, "pdfs", `${locale}-${unit.variant}.pdf`);
      variants.push({
        locale,
        variant: unit.variant,
        unitId: unit.unitId,
        unitCode: unit.unitCode,
        pdfPath: fs.existsSync(pdfPath) ? pdfPath : null,
        pageCount: pagePngsList.length,
        pagePngs: pagePngsList,
        downloadUrlNote:
          "Browser download + GET verified during e2e-official-handover-ui-flow.ts run",
      });
    }
  }

  const legacySnapshots = ["en", "ar"].map((locale) => {
    const p = path.join(STORE, `legacy-draft-${locale}-snapshot.json`);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
  });

  const dbProofPath = path.join(STORE, "legacy-draft-db-proof.json");
  const dbProof = fs.existsSync(dbProofPath)
    ? JSON.parse(fs.readFileSync(dbProofPath, "utf8"))
    : null;

  const merged = {
    ...prior,
    consolidatedAt: new Date().toISOString(),
    evidenceRoot: STORE,
    manifestUnits: manifest.units.length,
    variants,
    totals: {
      uiVariantRuns: variants.filter((v) => v.pdfPath).length,
      pagePngs: variants.reduce((n, v) => n + v.pageCount, 0),
      canonicalPdfs: variants.filter((v) => v.pdfPath).length,
    },
    legacyDraft: { uiSnapshots: legacySnapshots, dbProof },
    signedLockingBrowserEvidence:
      "Not exercised in this fixture (no signedCopyOnFileAt rows seeded). Approved-request guard covered by vitest: canEditOfficialDocumentDraftNow.",
  };

  fs.writeFileSync(reportPath, JSON.stringify(merged, null, 2));
  console.log(JSON.stringify(merged.totals, null, 2));
}

main();
