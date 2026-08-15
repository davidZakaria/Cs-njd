import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import { createAgentResolver } from "../lib/import/agents";
import { isLikelyAgentName } from "../lib/import/columns";
import { buildStaffAliasMap, normalizeAgentKey } from "../lib/staff";

function col(row: unknown[], index: number) {
  const value = row[index];
  if (value == null || String(value).trim() === "") return undefined;
  return String(value).trim();
}

function getCell(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return undefined;
}

async function main() {
  const filePath =
    process.argv[2] ??
    path.join(process.cwd(), "data/legacy/0CS NJD 26-6-2026.xlsx");

  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const resolver = await createAgentResolver();
  const aliasMap = buildStaffAliasMap();

  const counts = new Map<string, { resolved: boolean; count: number; email?: string }>();

  async function track(name?: string) {
    if (!isLikelyAgentName(name)) return;
    const clean = name!.trim();
    const key = normalizeAgentKey(clean);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }

    const agentId = await resolver.resolve(clean);
    const email = aliasMap.get(key);
    counts.set(key, {
      resolved: agentId != null,
      count: 1,
      email,
    });
  }

  const masterName = workbook.SheetNames.find((n) =>
    n.trim().toLowerCase().includes("njd 2026")
  );
  if (masterName) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[masterName], {
      header: 1,
      defval: "",
    });
    for (let i = 1; i < rows.length; i++) {
      await track(col(rows[i], 13));
    }
  }

  for (const sheetName of workbook.SheetNames) {
    const lower = sheetName.trim().toLowerCase();
    if (lower === "final") {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[sheetName],
        { defval: "" }
      );
      for (const row of rows) {
        await track(getCell(row, "المسئول", "B"));
      }
    }
    if (sheetName.includes("تشطيبات جرين")) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[sheetName],
        { defval: "" }
      );
      for (const row of rows) {
        await track(getCell(row, "المسئول", "C"));
      }
    }
    if (sheetName.includes("وحدات الفسخ")) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[sheetName],
        { defval: "" }
      );
      for (const row of rows) {
        await track(getCell(row, "__EMPTY", "المسئول"));
      }
    }
    if (sheetName.includes("جاهزيه وحدات")) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[sheetName],
        { defval: "" }
      );
      for (const row of rows) {
        await track(getCell(row, "CS", "المسئول", "C", "I"));
      }
    }
    if (sheetName.includes("اعذارات")) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[sheetName],
        { defval: "" }
      );
      for (const row of rows) {
        await track(getCell(row, "المسئول", "E"));
      }
    }
  }

  const resolved = [...counts.entries()]
    .filter(([, v]) => v.resolved)
    .sort((a, b) => b[1].count - a[1].count);
  const unresolved = [...counts.entries()]
    .filter(([, v]) => !v.resolved)
    .sort((a, b) => b[1].count - a[1].count);

  console.log("\n=== RESOLVED AGENTS ===");
  for (const [key, info] of resolved) {
    console.log(`${info.count.toString().padStart(4)}  ${key}  →  ${info.email ?? "fuzzy match"}`);
  }

  console.log("\n=== UNRESOLVED AGENTS (need mapping or ignore) ===");
  for (const [key, info] of unresolved) {
    console.log(`${info.count.toString().padStart(4)}  ${key}`);
  }

  console.log("\n=== SUMMARY ===");
  console.log({
    uniqueResolved: resolved.length,
    uniqueUnresolved: unresolved.length,
    rowsResolved: resolved.reduce((s, [, v]) => s + v.count, 0),
    rowsUnresolved: unresolved.reduce((s, [, v]) => s + v.count, 0),
  });
}

main().catch(console.error);
