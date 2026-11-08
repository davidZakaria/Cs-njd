/**
 * PR #45 layout evidence — fake data only. Writes to HANDOVER_E2E_STORE (Agent Store).
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { buildOfficialHandoverDraftBody } from "@/lib/official-documents/handover/build-body";
import {
  buildOfficialHandoverHtml,
  closeHandoverPdfBrowser,
  renderOfficialHandoverRecordPdf,
  renderPdfBufferToPngPages,
} from "@/lib/official-documents/handover/render-pdf";
import type { HandoverFieldValues, HandoverTemplateKey } from "@/lib/print/handover-templates/types";

const STORE =
  process.env.HANDOVER_E2E_STORE?.trim() ||
  "/cursor/stores/self/handover-e2e-ui-evidence";
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.join(STORE, "handover-layout-evidence", RUN_ID);

const VARIANTS: HandoverTemplateKey[] = [
  "green-avenue",
  "green-avenue-no-insurance",
  "green-avenue-dual",
  "green-avenue-dual-no-insurance",
  "jura",
  "jura-dual",
];

const baseFields: HandoverFieldValues = {
  clientName: "Demo Owner",
  nationality: "مصري",
  nationalId: "29001010000001",
  address: "12 Demo Street, Cairo",
  phone1: "+201000000001",
  phone2: "—",
  email: "demo-owner-green-avenue-1@example.test",
  unitNumber: "701",
  floor: "3",
  building: "B",
  area: "145",
  areaInWords: "145",
  handoverDate: "17/05/2026",
  contractDay: "30",
  contractMonth: "September",
  contractYear: "2025",
  issuedDayName: "Sunday",
  issuedDate: "17/05/2026",
  contractShortDate: "30/09/2025",
};

const dualFields: HandoverFieldValues = {
  ...baseFields,
  clientName: "Owner One",
  clientName2: "Owner Two",
  nationalId2: "29001010000002",
};

const SUBSTANTIAL_LEGAL_EDIT = `
ملاحظات إدارية — إضافة للتدقيق (بيانات تجريبية غير إنتاجية):

أولًا: يُقر المشتري بأن هذه الفقرة المضافة هي محض توضيح إداري لاختبار حفظ النص المعدّل وتوليد ملف PDF دون المساس بصياغة بنود العقد الأصلية أو ترتيب أقسام المحضر الرسمي.

ثانيًا: أي ملاحظات فنية عن حالة التشطيب المسجلة هنا لا تعدّ نسخة معدّلة للعقد ولا تُلزم الشركة إلا إذا أقرت كتابةً وفق آليات الإدارة المعتمدة، ويظل المحضر مرجعًا للاستلام الفعلي للوحدة بحالتها الراهنة.

ثالثًا: يلتزم المشتري بالتنسيق مع إدارة المشروع فيما يخص مواعيد المعاينة اللاحقة وأي طلبات صيانة ضمن ضوابط الاستخدام العام للمجمع السكني دون إخلال ببنود المخالفات المبينة في هذا المحضر.

رابعًا: تم إدراج هذه الفقرات لاختبار ترقيم الصفحات واستمرار تذييل التوقيع على كل صفحة مع نص قانوني إضافي بطول كافٍ للمراجعة المستقلة.
`.trim();

function fieldsFor(key: HandoverTemplateKey): HandoverFieldValues {
  return key.includes("dual") ? dualFields : baseFields;
}

function pdfPageCount(pdfPath: string): number {
  const m = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" }).match(/Pages:\s+(\d+)/);
  return m ? Number(m[1]) : 0;
}

function pdfPageText(pdfPath: string, page: number): string {
  return execFileSync("pdftotext", ["-f", String(page), "-l", String(page), pdfPath, "-"], {
    encoding: "utf8",
  });
}

async function writeVariant(key: HandoverTemplateKey, draftBody: string, subdir: string) {
  const fields = fieldsFor(key);
  const dir = path.join(OUT, subdir, key);
  fs.mkdirSync(dir, { recursive: true });

  const pdfBytes = await renderOfficialHandoverRecordPdf({
    templateKey: key,
    fields,
    watermarkDraft: true,
    draftBody,
  });
  const pdfPath = path.join(dir, `${key}.pdf`);
  fs.writeFileSync(pdfPath, pdfBytes);
  const sha256 = createHash("sha256").update(pdfBytes).digest("hex");

  const pages = pdfPageCount(pdfPath);
  const pngDir = path.join(dir, "pages");
  fs.mkdirSync(pngDir, { recursive: true });
  await renderPdfBufferToPngPages(pdfBytes, pngDir, "page");

  const pageChecks: Array<{ page: number; hasFooter: boolean; substantiveChars: number }> = [];
  for (let p = 1; p <= pages; p += 1) {
    const text = pdfPageText(pdfPath, p);
    pageChecks.push({
      page: p,
      hasFooter: /المقر بما فيه/u.test(text),
      substantiveChars: text
        .replace(/المقر بما فيه/gu, "")
        .replace(/مسودة/gu, "")
        .replace(/\s+/g, " ")
        .trim().length,
    });
  }

  return { key, pdfPath, sha256, pages, pageChecks };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const canonicalResults = [];
  for (const key of VARIANTS) {
    const body = buildOfficialHandoverDraftBody({ templateKey: key, fields: fieldsFor(key) });
    canonicalResults.push(await writeVariant(key, body, "canonical-six"));
  }

  const longBody = `${buildOfficialHandoverDraftBody({
    templateKey: "green-avenue",
    fields: baseFields,
  })}\n\n${SUBSTANTIAL_LEGAL_EDIT}`;
  const longEdit = await writeVariant("green-avenue", longBody, "substantial-long-edit");

  const htmlSample = buildOfficialHandoverHtml({
    templateKey: "green-avenue",
    fields: baseFields,
    watermarkDraft: true,
    draftBody: longBody,
  });
  fs.writeFileSync(path.join(OUT, "substantial-long-edit", "sample.html"), htmlSample);

  const report = {
    runId: RUN_ID,
    storeRoot: OUT,
    agentStore: STORE,
    canonicalSix: canonicalResults,
    substantialLongEdit: longEdit,
    substantialEditParagraphs: 4,
    editSnippetStart: SUBSTANTIAL_LEGAL_EDIT.slice(0, 120),
  };
  fs.writeFileSync(path.join(OUT, "evidence-report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(STORE, "handover-layout-evidence", "LATEST.txt"),
    `${RUN_ID}\n${OUT}\n`
  );
  console.log("EVIDENCE_PACK", OUT);
  await closeHandoverPdfBrowser();
}

main().catch((err) => {
  console.error(err);
  void closeHandoverPdfBrowser();
  process.exit(1);
});
