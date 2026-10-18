/**
 * Admin-only: detect combined owner names and propose splitting into co-owners.
 *
 * Dry-run (default): writes CSV with approve column (empty) and needsReview flag.
 * Apply: npx tsx scripts/split-joint-owners.ts --apply --csv=proposals.csv
 *   Only rows with approve=yes are applied; renames primary to first part and creates co-owners.
 *
 * Requires SPLIT_JOINT_OWNERS_ACTOR_EMAIL (SUPER_ADMIN or MANAGEMENT).
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

import { UnitClientRole } from "@prisma/client";

import { withAuditAsUser } from "../lib/audit/with-audit";
import { analyzeJointOwnerName } from "../lib/import/split-joint-owner-name";
import { canAccessImportsOrUserAdmin } from "../lib/auth/role-permissions";
import { prisma } from "../lib/prisma";

type CsvRow = {
  unitId: string;
  projectName: string;
  unitCode: string;
  clientId: string;
  currentName: string;
  separator: string;
  proposedNames: string;
  needsReview: string;
  approve: string;
};

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: CsvRow[]): string {
  const header = [
    "unitId",
    "project",
    "unitCode",
    "clientId",
    "currentName",
    "separator",
    "proposedNames",
    "needsReview",
    "approve",
  ];
  const lines = rows.map((row) =>
    [
      row.unitId,
      escapeCsv(row.projectName),
      row.unitCode,
      row.clientId,
      escapeCsv(row.currentName),
      escapeCsv(row.separator),
      escapeCsv(row.proposedNames),
      row.needsReview,
      row.approve,
    ].join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  const idx = (name: string) => header.indexOf(name);

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      unitId: cols[idx("unitId")] ?? "",
      projectName: cols[idx("project")] ?? "",
      unitCode: cols[idx("unitCode")] ?? "",
      clientId: cols[idx("clientId")] ?? "",
      currentName: cols[idx("currentName")] ?? "",
      separator: cols[idx("separator")] ?? "",
      proposedNames: cols[idx("proposedNames")] ?? "",
      needsReview: cols[idx("needsReview")] ?? "",
      approve: cols[idx("approve")] ?? "",
    };
  });
}

async function resolveActor() {
  const actorEmail = process.env.SPLIT_JOINT_OWNERS_ACTOR_EMAIL?.trim();
  if (!actorEmail) {
    console.error(
      "Set SPLIT_JOINT_OWNERS_ACTOR_EMAIL to a SUPER_ADMIN or MANAGEMENT user email."
    );
    process.exit(1);
  }

  const actor = await prisma.user.findUnique({
    where: { email: actorEmail.toLowerCase() },
    select: { id: true, role: true, email: true },
  });
  if (!actor || !canAccessImportsOrUserAdmin(actor.role)) {
    console.error("Actor must be SUPER_ADMIN or MANAGEMENT.");
    process.exit(1);
  }
  return actor;
}

async function buildProposals(): Promise<CsvRow[]> {
  const units = await prisma.unit.findMany({
    where: { deletedAt: null, clientId: { not: null } },
    include: {
      project: { select: { name: true } },
      client: { select: { id: true, name: true } },
      unitClients: { where: { role: UnitClientRole.CO_OWNER }, select: { id: true } },
    },
  });

  const rows: CsvRow[] = [];

  for (const unit of units) {
    const client = unit.client;
    if (!client) continue;
    if (unit.unitClients.length > 0) continue;

    const analysis = analyzeJointOwnerName(client.name);
    if (analysis.kind === "none") continue;

    if (analysis.kind === "needsReview") {
      rows.push({
        unitId: unit.id,
        projectName: unit.project.name,
        unitCode: unit.unitCode,
        clientId: client.id,
        currentName: client.name,
        separator: "",
        proposedNames: "",
        needsReview: "yes",
        approve: "",
      });
      continue;
    }

    rows.push({
      unitId: unit.id,
      projectName: unit.project.name,
      unitCode: unit.unitCode,
      clientId: client.id,
      currentName: client.name,
      separator: analysis.separator,
      proposedNames: analysis.parts.join(" | "),
      needsReview: "no",
      approve: "",
    });
  }

  return rows;
}

async function applyApprovedRows(
  actorUserId: string,
  rows: CsvRow[]
): Promise<number> {
  let created = 0;

  for (const row of rows) {
    if (row.approve.trim().toLowerCase() !== "yes") continue;
    if (row.needsReview.trim().toLowerCase() === "yes") {
      console.warn(`Skipping needs-review row unit ${row.unitId}`);
      continue;
    }

    const analysis = analyzeJointOwnerName(row.currentName);
    if (analysis.kind !== "split") {
      console.warn(`Skipping unit ${row.unitId}: name no longer splittable`);
      continue;
    }

    const [primaryName, ...coNames] = analysis.parts;
    if (!primaryName || coNames.length === 0) continue;

    await withAuditAsUser(actorUserId, async () => {
      await prisma.$transaction(async (tx) => {
        await tx.client.update({
          where: { id: row.clientId },
          data: { name: primaryName },
        });

        const maxPos = await tx.unitClient.aggregate({
          where: { unitId: row.unitId },
          _max: { position: true },
        });
        let position = (maxPos._max.position ?? 0) + 1;

        for (const coName of coNames) {
          const coClient = await tx.client.create({
            data: { name: coName },
          });
          await tx.unitClient.create({
            data: {
              unitId: row.unitId,
              clientId: coClient.id,
              role: UnitClientRole.CO_OWNER,
              position,
            },
          });
          position += 1;
          created += 1;
        }
      });
    });
  }

  return created;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const outArg = process.argv.find((a) => a.startsWith("--out="));
  const csvArg = process.argv.find((a) => a.startsWith("--csv="));
  const outPath = outArg?.slice("--out=".length) ?? "joint-owner-split-proposals.csv";

  const actor = await resolveActor();

  if (apply) {
    const csvPath = csvArg?.slice("--csv=".length);
    if (!csvPath) {
      console.error("--apply requires --csv=<path> from a prior dry-run export.");
      process.exit(1);
    }
    const rows = parseCsv(readFileSync(csvPath, "utf8"));
    const created = await applyApprovedRows(actor.id, rows);
    console.log(`Applied approved rows; created ${created} co-owner link(s).`);
    return;
  }

  const proposals = await buildProposals();
  writeFileSync(outPath, toCsv(proposals), "utf8");
  console.log(
    `Wrote ${proposals.length} row(s) to ${outPath} (dry run). Set approve=yes and run with --apply --csv=${outPath}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
