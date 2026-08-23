/**
 * Generates data/demo/njd-import-demo.xlsx — a minimal workbook matching ingestWorkbook().
 * Run: npx tsx scripts/generate-import-demo.ts
 */
import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

const OUT_DIR = path.join(process.cwd(), "data", "demo");
const OUT_FILE = path.join(OUT_DIR, "njd-import-demo.xlsx");

/** Master sheet row 0 — header labels (also used by name-based column lookup). */
const MASTER_HEADERS: string[] = [
  "#",
  "PROJECT",
  "Contract Date",
  "Client Name",
  "Unit Code",
  "النوع",
  "مساحة الوحده",
  "Delivery Date",
  "محضر استلام",
  "Handover note",
  "الشركة المنفذة",
  "",
  "Action label",
  "ACTION",
  "RESPONSIBL",
  "custmer service",
  "FEEDBACK OLD",
  "Finishing",
  "اجمالي التشطيب",
  "",
  "Phone",
  "القانونيه",
  "اعذارات",
  "Category",
  "الهندسيه",
  "عنوان 1",
  "عنوان 2",
  "السنه للتسليم",
  "فترة سماح",
  "نوع / باقة التشطيب",
  "الشركه المنفذه",
  "سعر المتر",
  "رسوم الباب",
  "الالوميتال",
  "تاريخ التعاقد",
  "موقف الوحده الحالي من التشطيب",
];

function masterRow(values: Partial<Record<number, string | number>>): unknown[] {
  const row: unknown[] = [...MASTER_HEADERS];
  for (const [index, value] of Object.entries(values)) {
    row[Number(index)] = value;
  }
  return row;
}

const masterData = [
  MASTER_HEADERS,
  masterRow({
    1: "GREEN AVENUE",
    2: "2024-01-15",
    3: "أحمد محمد علي",
    4: "GA-101",
    5: "شقة",
    6: 125,
    7: "2026-06-01",
    8: "في انتظار الاستلام",
    10: "تشطيب شركة NJD",
    13: "متابعة مع العميل",
    14: "Mohamed Hassan",
    15: "العميل ينتظر موعد المعاينة",
    16: "تم التواصل 2024-03-01",
    17: "باقة الشركة",
    18: 275000,
    20: "01001234567 / 01112223333",
    25: "التجمع الخامس - القاهرة الجديدة",
    26: "شارع 90",
    27: "2026",
    28: "3 أشهر",
    29: "باقة الشركة",
    30: "تشطيب شركة NJD",
    31: 2200,
    32: 5000,
    33: 8000,
    34: "2024-01-15",
    35: "أعمال المحارة",
  }),
  masterRow({
    1: "JURA",
    2: "2023-11-20",
    3: "سارة إبراهيم",
    4: "J-205",
    5: "دوبلكس",
    6: 180,
    7: "2025-12-01",
    8: "تم توقيع محضر استلام",
    10: "تشطيب شركة NJD",
    13: "—",
    14: "Mohamed Hassan",
    15: "",
    17: "3/4 تشطيب",
    18: 396000,
    20: "01098765432",
    25: "6 أكتوبر",
    27: "2025",
    29: "3/4 تشطيب",
    30: "تشطيب شركة NJD",
    31: 2200,
    35: "تم التشطيب",
  }),
];

/** Optional "final" sheet — finishing / legal enrichment by Arabic headers. */
const finalData = [
  {
    المسئول: "Mohamed Hassan",
    "اسم المشروع": "GREEN AVENUE",
    "اسم العميل": "أحمد محمد علي",
    "رقم الوحده": "GA-101",
    النوع: "شقة",
    "مساحة الوحده": 125,
    "المؤرخ في": "2024-01-20",
    "نوع / باقة التشطيب": "باقة الشركة",
    "الشركه المنفذه": "تشطيب شركة NJD",
    "تاريخ التعاقد": "2024-01-15",
    "سعر المتر": 2200,
    "اجمالي التشطيب": 275000,
    "رسوم الباب": 5000,
    الالوميتال: 8000,
    "موقف الوحده الحالي من التشطيب": "أعمال الكهرباء",
    ملاحظات: "Demo import — general notes",
  },
];

async function main() {
  const workbook = XLSX.utils.book_new();

  const masterSheet = XLSX.utils.aoa_to_sheet(masterData);
  XLSX.utils.book_append_sheet(workbook, masterSheet, "NJD 2026");

  const finalSheet = XLSX.utils.json_to_sheet(finalData);
  XLSX.utils.book_append_sheet(workbook, finalSheet, "final");

  await fs.mkdir(OUT_DIR, { recursive: true });
  XLSX.writeFile(workbook, OUT_FILE);

  console.log(`Wrote ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
