import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";

import { prisma } from "../prisma";
import { resolveImportProjectName } from "./project-names";
import { normalizeUnitCode, splitPhones } from "./sanitize";

type Row = Record<string, unknown>;

export const DEFAULT_CONTACT_SYNC_FILE = path.join(
  process.cwd(),
  "docs/Copy of Njd 2026 - Update (full contacts).xlsx"
);

export function parseUpdateClientsArgs(argv: string[]) {
  let file = DEFAULT_CONTACT_SYNC_FILE;
  let apply = false;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--file" && argv[i + 1]) {
      file = argv[i + 1];
      i += 1;
    }
  }
  return { file, apply };
}

function splitNationalId(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const first = text.split(/[/|]/)[0]?.trim() ?? "";
  if (!first) return null;
  if (/^[a-z]/i.test(first) && first.length < 8) return null;
  return first;
}

function sanitizePhoneToken(token: string): string | null {
  const cleaned = token.replace(/\s+/g, "").trim();
  if (!cleaned) return null;
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return cleaned;
}

function parsePhones(raw: unknown): { phone1: string | null; phone2: string | null } {
  const text = String(raw ?? "").trim();
  if (!text) return { phone1: null, phone2: null };
  const parts = text
    .split(/[/|,;\n]/)
    .map((part) => sanitizePhoneToken(part))
    .filter((part): part is string => Boolean(part));
  if (parts.length >= 2) {
    return { phone1: parts[0], phone2: parts[1] };
  }
  const legacy = splitPhones(text);
  return {
    phone1: legacy.phone1 ? sanitizePhoneToken(legacy.phone1) : null,
    phone2: legacy.phone2 ? sanitizePhoneToken(legacy.phone2) : null,
  };
}

export async function runUpdateClientsFromExcel(argv: string[]) {
  const { file, apply } = parseUpdateClientsArgs(argv);
  const buffer = await fs.readFile(file);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName =
    workbook.SheetNames.find((name) => name.toUpperCase() === "DATABASE") ??
    workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Workbook has no sheets");
  }

  const rows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheetName], {
    defval: "",
  });

  const seenKeys = new Set<string>();
  const report = {
    mode: apply ? "apply" : "dry-run",
    file,
    sheet: sheetName,
    totalRows: rows.length,
    updated: 0,
    skippedNoUnit: 0,
    skippedDuplicateRow: 0,
    skippedNoClient: 0,
    nationalIdConflicts: [] as string[],
    duplicateRowKeys: [] as string[],
    missingUnits: [] as string[],
  };

  for (const row of rows) {
    const projectRaw = String(row.Project ?? "").trim();
    const unitCodeRaw = String(row["Unit Code"] ?? "").trim();
    const name = String(row.Name ?? "").trim();
    if (!projectRaw || !unitCodeRaw || !name) continue;

    const projectName = resolveImportProjectName(projectRaw);
    const unitCode = normalizeUnitCode(unitCodeRaw);
    const key = `${projectName}::${unitCode}`;

    if (seenKeys.has(key)) {
      report.skippedDuplicateRow += 1;
      report.duplicateRowKeys.push(key);
      continue;
    }
    seenKeys.add(key);

    const project = await prisma.project.findUnique({
      where: { name: projectName },
      select: { id: true },
    });
    if (!project) {
      report.skippedNoUnit += 1;
      report.missingUnits.push(`${key} (project missing)`);
      continue;
    }

    const unit = await prisma.unit.findFirst({
      where: {
        projectId: project.id,
        unitCode,
        deletedAt: null,
      },
      select: { id: true, clientId: true },
    });

    if (!unit) {
      report.skippedNoUnit += 1;
      report.missingUnits.push(key);
      continue;
    }

    if (!unit.clientId) {
      report.skippedNoClient += 1;
      continue;
    }

    const { phone1, phone2 } = parsePhones(row.mobile);
    const nationalId = splitNationalId(row.id);
    const address1 = String(row.Adress ?? row.Address ?? "").trim() || null;

    const clientData: {
      name: string;
      phone1: string | null;
      phone2: string | null;
      address1: string | null;
      nationalId?: string | null;
    } = {
      name,
      phone1,
      phone2,
      address1,
    };

    if (nationalId) {
      const conflict = await prisma.client.findFirst({
        where: {
          nationalId,
          NOT: { id: unit.clientId },
        },
        select: { id: true },
      });
      if (conflict) {
        report.nationalIdConflicts.push(`${key} → ${nationalId}`);
      } else {
        clientData.nationalId = nationalId;
      }
    }

    if (apply) {
      await prisma.client.update({
        where: { id: unit.clientId },
        data: clientData,
      });
    }
    report.updated += 1;
  }

  console.log(JSON.stringify(report, null, 2));
  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to write changes.");
  }

  return report;
}
