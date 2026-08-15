import * as XLSX from "xlsx";
import * as fs from "fs";
import { basePrisma as prisma } from "../lib/prisma";
import { createAgentResolver } from "../lib/import/agents";
import { buildStaffAliasMap, normalizeAgentKey } from "../lib/staff";
import { normalizeProjectName, normalizeUnitCode } from "../lib/import/sanitize";

const path = "data/legacy/0CS NJD 26-6-2026.xlsx";

function col(row: unknown[], index: number) {
  const value = row[index];
  if (value == null || String(value).trim() === "") return undefined;
  return value;
}

function getCell(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== "") return String(row[key]).trim();
  }
  const normalizedEntries = Object.entries(row);
  for (const key of keys) {
    const target = key.trim().toLowerCase();
    const match = normalizedEntries.find(([k]) => k.trim().toLowerCase() === target);
    if (match && String(match[1]).trim() !== "") return String(match[1]).trim();
  }
  return undefined;
}

async function main() {
  const buffer = fs.readFileSync(path);
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const master = wb.SheetNames.find((n) => n.toLowerCase().includes("njd 2026"))!;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[master], {
    header: 1,
    defval: "",
  });

  const resolver = await createAgentResolver();
  const aliasMap = buildStaffAliasMap();

  const agentNames = new Map<string, number>();
  for (let i = 1; i < rows.length; i++) {
    const agent = String(col(rows[i], 13) ?? "").trim();
    if (agent) agentNames.set(agent, (agentNames.get(agent) ?? 0) + 1);
  }

  console.log("Top RESPONSIBL values in master sheet:");
  [...agentNames.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([name, count]) => {
      const mapped = aliasMap.get(normalizeAgentKey(name)) ?? "(no roster match)";
      console.log(`  ${count}x  ${name} -> ${mapped}`);
    });

  let unitsUpdated = 0;
  let ticketsUpdated = 0;
  let unmatchedAgents = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const projectName = String(col(row, 1) ?? "").trim();
    const unitCode = col(row, 4);
    const agentName = String(col(row, 13) ?? "").trim();
    if (!projectName || !unitCode) continue;

    const agentId = agentName ? await resolver.resolve(agentName) : null;
    if (agentName && !agentId) unmatchedAgents.add(agentName);

    const project = await prisma.project.findUnique({
      where: { name: normalizeProjectName(projectName) },
    });
    if (!project) continue;

    const unit = await prisma.unit.findUnique({
      where: {
        projectId_unitCode: {
          projectId: project.id,
          unitCode: normalizeUnitCode(String(unitCode)),
        },
      },
    });
    if (!unit || !agentId) continue;

    if (unit.agentId !== agentId) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: { agentId },
      });
      unitsUpdated += 1;
    }

    const ticketUpdate = await prisma.ticket.updateMany({
      where: { unitId: unit.id, agentId: null },
      data: { agentId },
    });
    ticketsUpdated += ticketUpdate.count;
  }

  console.log("\nSync summary:");
  console.log("  Units assigned:", unitsUpdated);
  console.log("  Tickets assigned:", ticketsUpdated);
  console.log("  Unresolved agent names:", resolver.unresolvedCount);
  if (unmatchedAgents.size) {
    console.log("  Unmatched:", [...unmatchedAgents].slice(0, 15).join(", "));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
