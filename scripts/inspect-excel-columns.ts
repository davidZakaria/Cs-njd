import * as XLSX from "xlsx";
import * as fs from "fs";

const path = "data/legacy/0CS NJD 26-6-2026.xlsx";
const wb = XLSX.read(fs.readFileSync(path), { type: "buffer", cellDates: true });
const master = wb.SheetNames.find((n) => n.toLowerCase().includes("njd 2026"));
console.log("Sheets:", wb.SheetNames);
console.log("Master:", master);

if (master) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[master], { header: 1, defval: "" });
  console.log("\nHeader indices 0-25:");
  (rows[0] as unknown[]).forEach((h, i) => console.log(i, JSON.stringify(h)));

  console.log("\nSample rows with long col 14/15:");
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const agent = r[13];
    const c14 = String(r[14] ?? "");
    const c15 = String(r[15] ?? "");
    if (c14.length > 40 || c15.length > 40) {
      console.log({
        row: i + 1,
        agent,
        c14: c14.slice(0, 100),
        c15: c15.slice(0, 100),
      });
    }
  }
}

const cancelled = wb.SheetNames.find((n) => n.includes("وحدات الفسخ"));
if (cancelled) {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[cancelled], { defval: "" });
  console.log("\nCancelled headers:", Object.keys(rows[0] ?? {}));
  console.log("Cancelled sample I/J:", rows[0]?.["COMMENT"], rows[0]?.["ACTION"]);
}
