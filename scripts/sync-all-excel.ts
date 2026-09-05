import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { ingestWorkbooks } from "../lib/import/ingest";

const DEFAULT_FILES = [
  "docs/updated final.xlsx",
  "docs/Greenavenue & Genesis Delivery .xlsx",
  "docs/Jamila Clients Data.xlsx",
];

/**
 * Sync master + supplemental workbooks:
 * - updated final.xlsx (NJD 2026 master + FINAL finishing)
 * - Greenavenue & Genesis Delivery .xlsx (delivery / legal / engineering columns)
 * - Jamila Clients Data.xlsx (Jamila North Coast units)
 */
async function main() {
  const filePaths =
    process.argv.length > 2
      ? process.argv.slice(2)
      : DEFAULT_FILES.map((rel) => path.join(process.cwd(), rel));

  const buffers: Buffer[] = [];
  for (const filePath of filePaths) {
    console.log(`Reading ${filePath}…`);
    buffers.push(await fs.readFile(filePath));
  }

  const result = await ingestWorkbooks(buffers);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
