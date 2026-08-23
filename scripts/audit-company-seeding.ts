import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import {
  mapExecutingCompany,
  resolveExecutingCompanyLabel,
  IMPORT_COLUMN_HEADERS,
} from "../lib/import/columns";

const filePath = path.join(process.cwd(), "updated.xlsx");
const wb = XLSX.read(fs.readFileSync(filePath), { type: "buffer", cellDates: true });

function col(row: unknown[], index: number) {
  return String(row[index] ?? "").trim();
}

function cellString(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const target = key.trim().toLowerCase();
    const match = Object.entries(row).find(([k]) => k.trim().toLowerCase() === target);
    if (match && String(match[1]).trim()) return String(match[1]).trim();
  }
  return undefined;
}

type UnitSeed = {
  project: string;
  unit: string;
  company: string;
  enum: string;
  sheet: string;
};

const seeded = new Map<string, UnitSeed>();

function remember(sheet: string, project: string, unit: string, company?: string) {
  if (!project || !unit || !company) return;
  const mapped = mapExecutingCompany(company);
  if (!mapped) return;
  seeded.set(`${project}::${unit}`, {
    project,
    unit,
    company,
    enum: mapped,
    sheet,
  });
}

const masterName = wb.SheetNames.find((n) => n.includes("NJD 2026")) ?? "";
if (masterName) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[masterName], {
    header: 1,
    defval: "",
  });
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const company = resolveExecutingCompanyLabel(col(row, 10));
    remember(masterName, col(row, 1), col(row, 4), company);
  }
}

for (const sheetName of wb.SheetNames) {
  if (
    sheetName === "FINAL" ||
    sheetName.includes("تشطيبات جرين") ||
    sheetName.includes("جاهزيه وحدات GREEN")
  ) {
    const objectRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      wb.Sheets[sheetName],
      { defval: "" }
    );
    const arrayRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    });
    for (let i = 0; i < objectRows.length; i++) {
      const row = objectRows[i];
      const arrayRow = arrayRows[i + 1] ?? [];
      const project = String(
        cellString(row, "PROJECT", "اسم المشروع") ?? "GREEN AVENUE"
      ).trim();
      const unit = cellString(row, "UNIT NO.", "رقم الوحده") ?? col(arrayRow, 5);
      const company = resolveExecutingCompanyLabel(
        cellString(row, ...IMPORT_COLUMN_HEADERS.executingCompany),
        col(arrayRow, 9),
        cellString(row, "تشطيب")
      );
      remember(sheetName, project, unit, company);
    }
  }
}

const byEnum = { NJD: 0, GERGES_YOUSSEF: 0, OTHER: 0 };
for (const item of seeded.values()) {
  if (item.enum in byEnum) byEnum[item.enum as keyof typeof byEnum] += 1;
}

console.log("Units that will receive executingCompany:");
console.log("  Total:", seeded.size);
console.log("  NJD:", byEnum.NJD);
console.log("  Gerges Youssef:", byEnum.GERGES_YOUSSEF);
console.log("\nSample:");
[...seeded.values()].slice(0, 8).forEach((item) => {
  console.log(`  ${item.project} ${item.unit} → ${item.enum} (${item.sheet})`);
});
