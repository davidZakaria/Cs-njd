import * as XLSX from "xlsx";
import { basePrisma as prisma } from "@/lib/prisma";
import { createAgentResolver, type AgentResolver } from "@/lib/import/agents";
import { normalizeProjectName, normalizeUnitCode } from "@/lib/import/sanitize";

type Row = Record<string, unknown>;
type AssignmentRow = {
  projectName: string;
  unitCode: string;
  agentName?: string;
};

function col(row: unknown[], index: number) {
  const value = row[index];
  if (value == null || String(value).trim() === "") return undefined;
  return value;
}

function getCell(row: Row, ...keys: string[]) {
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

function findSheet(workbook: XLSX.WorkBook, matcher: (name: string) => boolean) {
  return workbook.SheetNames.find(matcher) ?? "";
}

async function assignUnitAgent(
  resolver: AgentResolver,
  input: AssignmentRow,
  stats: { units: number; tickets: number; unmatched: Set<string> }
) {
  if (!input.projectName || !input.unitCode || !input.agentName) return;

  const agentId = await resolver.resolve(input.agentName);
  if (!agentId) {
    stats.unmatched.add(input.agentName);
    return;
  }

  const project = await prisma.project.findUnique({
    where: { name: normalizeProjectName(input.projectName) },
  });
  if (!project) return;

  const unit = await prisma.unit.findUnique({
    where: {
      projectId_unitCode: {
        projectId: project.id,
        unitCode: normalizeUnitCode(String(input.unitCode)),
      },
    },
  });
  if (!unit) return;

  if (unit.agentId !== agentId) {
    await prisma.unit.update({
      where: { id: unit.id },
      data: { agentId },
    });
    stats.units += 1;
  }

  const ticketUpdate = await prisma.ticket.updateMany({
    where: { unitId: unit.id },
    data: { agentId },
  });
  stats.tickets += ticketUpdate.count;
}

export async function syncAssignmentsFromWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const resolver = await createAgentResolver();
  const stats = { units: 0, tickets: 0, unmatched: new Set<string>() };

  const masterName = findSheet(workbook, (n) => n.trim().toLowerCase().includes("njd 2026"));
  const finalName = findSheet(workbook, (n) => n.trim().toLowerCase() === "final");
  const greenFinishName = findSheet(workbook, (n) => n.includes("تشطيبات جرين"));
  const cancelledName = findSheet(workbook, (n) => n.includes("وحدات الفسخ"));
  const juraReadyName = findSheet(workbook, (n) => n.includes("جاهزيه وحدات JURA"));
  const greenReadyName = findSheet(workbook, (n) => n.includes("جاهزيه وحدات GREEN"));
  const warningsName = findSheet(workbook, (n) => n.includes("اعذارات"));

  if (masterName) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[masterName], {
      header: 1,
      defval: "",
    });
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      await assignUnitAgent(resolver, {
        projectName: String(col(row, 1) ?? "").trim(),
        unitCode: String(col(row, 4) ?? ""),
        agentName: String(col(row, 14) ?? "").trim() || undefined,
      }, stats);
    }
  }

  if (finalName) {
    const rows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[finalName], { defval: "" });
    for (const row of rows) {
      await assignUnitAgent(resolver, {
        projectName: String(getCell(row, "اسم المشروع", "PROJECT", "C") ?? "").trim(),
        unitCode: String(getCell(row, "رقم الوحده", "E") ?? ""),
        agentName: getCell(row, "المسئول", "B"),
      }, stats);
    }
  }

  if (greenFinishName) {
    const rows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[greenFinishName], { defval: "" });
    for (const row of rows) {
      await assignUnitAgent(resolver, {
        projectName: String(getCell(row, "اسم المشروع", "D") ?? "GREEN AVENUE").trim(),
        unitCode: String(getCell(row, "رقم الوحده", "F") ?? ""),
        agentName: getCell(row, "المسئول", "C"),
      }, stats);
    }
  }

  if (cancelledName) {
    const rows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[cancelledName], { defval: "" });
    for (const row of rows) {
      await assignUnitAgent(resolver, {
        projectName: String(getCell(row, "PROJECT", "B") ?? "").trim(),
        unitCode: String(getCell(row, " Unit Code", "Unit Code", "E") ?? ""),
        agentName: getCell(row, "__EMPTY", "المسئول"),
      }, stats);
    }
  }

  for (const sheetName of [juraReadyName, greenReadyName]) {
    if (!sheetName) continue;
    const rows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheetName], { defval: "" });
    for (const row of rows) {
      await assignUnitAgent(resolver, {
        projectName: String(getCell(row, "PROJECT", "اسم المشروع", "C", "D") ?? "").trim(),
        unitCode: String(getCell(row, "UNIT NO.", "رقم الوحده", "E", "F") ?? ""),
        agentName: getCell(row, "CS", "المسئول", "C", "I"),
      }, stats);
    }
  }

  if (warningsName) {
    const rows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[warningsName], { defval: "" });
    for (const row of rows) {
      const clientName = String(getCell(row, "اسم العميل", "B") ?? "").trim();
      const unitCode = getCell(row, "رقم الوحده", "C");
      const agentName = getCell(row, "المسئول", "E");
      if (!clientName || !unitCode || !agentName) continue;

      const agentId = await resolver.resolve(agentName);
      if (!agentId) {
        stats.unmatched.add(agentName);
        continue;
      }

      const unit = await prisma.unit.findFirst({
        where: {
          unitCode: normalizeUnitCode(String(unitCode)),
          client: { name: clientName },
        },
      });
      if (!unit) continue;

      const updated = await prisma.ticket.updateMany({
        where: { unitId: unit.id, category: "LEGAL" },
        data: { agentId },
      });
      stats.tickets += updated.count;
    }
  }

  return {
    unitsAssigned: stats.units,
    ticketsAssigned: stats.tickets,
    agentsUnresolved: resolver.unresolvedCount,
    unmatchedAgentNames: [...stats.unmatched].sort(),
  };
}
