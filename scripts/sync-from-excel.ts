import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { ingestWorkbook } from "../lib/import/ingest";

async function main() {
  const filePath =
    process.argv[2] ??
    path.join(process.cwd(), "data/legacy/0CS NJD 26-6-2026.xlsx");

  const buffer = await fs.readFile(filePath);
  const result = await ingestWorkbook(buffer);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
