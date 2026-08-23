import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import {
  buildMasterSheetCases,
  isDeliveryProtocolSigned,
  hasOpenIssueFromComments,
} from "../lib/import/master-cases";

const filePath = path.join(process.cwd(), "updated.xlsx");
const wb = XLSX.read(fs.readFileSync(filePath), { type: "buffer", cellDates: true });
const sheetName = wb.SheetNames.find((n) => n.trim().startsWith("NJD")) ?? "";
const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
  header: 1,
  defval: "",
});

function cell(row: unknown[], i: number) {
  return String(row[i] ?? "").trim();
}

type AuditRow = {
  project: string;
  unit: string;
  client: string;
  handover: string;
  status: string;
  openIssue: boolean;
  csNote: string;
};

const resolved: AuditRow[] = [];
const shouldBeUnresolved: AuditRow[] = [];
const signedButPending: AuditRow[] = [];

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const project = cell(row, 1);
  const unit = cell(row, 4);
  const client = cell(row, 3);
  if (!project || !unit || !client) continue;

  const handover = cell(row, 8);
  const input = {
    handoverRaw: handover,
    actionRaw: cell(row, 13),
    customerServiceRaw: cell(row, 15),
    feedbackOldRaw: cell(row, 16),
    legalRaw: cell(row, 21),
    warningsRaw: cell(row, 22),
    engineeringRaw: cell(row, 24),
  };

  const cases = buildMasterSheetCases(input);
  const cs = cases.find((c) => c.category === "CUSTOMER_SERVICE");
  if (!cs) continue;

  const openIssue = hasOpenIssueFromComments({
    handover,
    action: cell(row, 13),
    customerService: cell(row, 15),
    warnings: cell(row, 22),
  });

  const entry: AuditRow = {
    project,
    unit,
    client,
    handover,
    status: cs.status ?? "PENDING",
    openIssue,
    csNote: cell(row, 15) || cell(row, 13),
  };

  if (isDeliveryProtocolSigned(handover)) {
    if (cs.status === "RESOLVED") resolved.push(entry);
    else signedButPending.push(entry);
  }
}

console.log("Sheet:", sheetName);
console.log("Signed protocol → RESOLVED:", resolved.length);
console.log("Signed protocol → still open:", signedButPending.length);
console.log("\n=== Signed but kept open (comments show ongoing issue) ===");
for (const row of signedButPending) {
  console.log(`${row.project} ${row.unit} ${row.client}`);
  console.log(`  Handover: ${row.handover}`);
  console.log(`  Status: ${row.status}`);
  console.log(`  Note: ${row.csNote.slice(0, 120)}${row.csNote.length > 120 ? "…" : ""}`);
  console.log("");
}

console.log("\n=== Sample resolved (signed + clean comments) ===");
for (const row of resolved.slice(0, 10)) {
  console.log(`${row.project} ${row.unit} → ${row.status}`);
}
