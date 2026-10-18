/**
 * Admin-only utility: detect combined owner names and propose splitting into co-owners.
 * Dry-run by default; pass --apply to create co-owner clients (never deletes).
 *
 * Usage:
 *   npx tsx scripts/split-joint-owners.ts [--apply] [--out proposals.csv]
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";

import { PrismaClient, UnitClientRole } from "@prisma/client";

import { canAccessImportsOrUserAdmin } from "../lib/auth/role-permissions";

const prisma = new PrismaClient();

const SEPARATORS = [" / ", " - "] as const;

type ProposalRow = {
  unitId: string;
  projectName: string;
  unitCode: string;
  currentClientId: string;
  currentName: string;
  proposedNames: string;
  separator: string;
};

function splitCombinedName(name: string): { parts: string[]; separator: string } | null {
  const trimmed = name.trim();
  for (const separator of SEPARATORS) {
    if (!trimmed.includes(separator)) continue;
    const parts = trimmed
      .split(separator)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length >= 2) {
      return { parts, separator };
    }
  }
  return null;
}

function toCsv(rows: ProposalRow[]): string {
  const header = [
    "unitId",
    "project",
    "unitCode",
    "clientId",
    "currentName",
    "separator",
    "proposedNames",
  ];
  const lines = rows.map((row) =>
    [
      row.unitId,
      row.projectName,
      row.unitCode,
      row.currentClientId,
      JSON.stringify(row.currentName),
      row.separator,
      JSON.stringify(row.proposedNames),
    ].join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const outArg = process.argv.find((a) => a.startsWith("--out="));
  const outPath = outArg?.slice("--out=".length) ?? "joint-owner-split-proposals.csv";

  const actorEmail = process.env.SPLIT_JOINT_OWNERS_ACTOR_EMAIL?.trim();
  if (!actorEmail) {
    console.error(
      "Set SPLIT_JOINT_OWNERS_ACTOR_EMAIL to a SUPER_ADMIN or MANAGEMENT user email."
    );
    process.exit(1);
  }

  const actor = await prisma.user.findUnique({
    where: { email: actorEmail.toLowerCase() },
    select: { role: true, email: true },
  });
  if (!actor || !canAccessImportsOrUserAdmin(actor.role)) {
    console.error("Actor must be SUPER_ADMIN or MANAGEMENT.");
    process.exit(1);
  }

  const units = await prisma.unit.findMany({
    where: { deletedAt: null, clientId: { not: null } },
    include: {
      project: { select: { name: true } },
      client: { select: { id: true, name: true } },
      unitClients: { where: { role: UnitClientRole.CO_OWNER }, select: { id: true } },
    },
  });

  const proposals: ProposalRow[] = [];

  for (const unit of units) {
    const client = unit.client;
    if (!client) continue;
    if (unit.unitClients.length > 0) continue;

    const split = splitCombinedName(client.name);
    if (!split) continue;

    proposals.push({
      unitId: unit.id,
      projectName: unit.project.name,
      unitCode: unit.unitCode,
      currentClientId: client.id,
      currentName: client.name,
      proposedNames: split.parts.join(" | "),
      separator: split.separator,
    });
  }

  writeFileSync(outPath, toCsv(proposals), "utf8");
  console.log(
    `Wrote ${proposals.length} proposal(s) to ${outPath}${apply ? "" : " (dry run)"}.`
  );

  if (!apply) {
    console.log("Re-run with --apply to create co-owner clients (no deletions).");
    return;
  }

  let created = 0;
  for (const row of proposals) {
    const split = splitCombinedName(row.currentName);
    if (!split) continue;
    const coNames = split.parts.slice(1);
    const maxPos = await prisma.unitClient.aggregate({
      where: { unitId: row.unitId },
      _max: { position: true },
    });
    let position = (maxPos._max.position ?? 0) + 1;

    for (const coName of coNames) {
      const coClient = await prisma.client.create({
        data: { name: coName },
      });
      await prisma.unitClient.create({
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
  }

  console.log(`Created ${created} co-owner client link(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
