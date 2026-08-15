import * as XLSX from "xlsx";
import { basePrisma as prisma } from "@/lib/prisma";
import { createAgentResolver } from "@/lib/import/agents";
import {
  mapFinishingType,
  mapHandoverStatus,
  mapUnitType,
} from "@/lib/import/columns";
import { parseLegacyDate } from "@/lib/import/dates";
import { parseLegacyNumber } from "@/lib/import/numbers";
import {
  normalizeProjectName,
  normalizeUnitCode,
  splitPhones,
} from "@/lib/import/sanitize";
import {
  buildMasterSheetCases,
  CANONICAL_CASE_CATEGORIES,
  type ImportCase,
} from "@/lib/import/master-cases";
import { syncAssignmentsFromWorkbook } from "@/lib/import/sync-assignments";
import type { HandoverStatus } from "@prisma/client";

type Row = Record<string, unknown>;

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  ticketsCreated: number;
  ticketsUpdated: number;
  ticketsSkipped: number;
  agentsUnresolved: number;
  unitsAssigned: number;
  ticketsAssigned: number;
  unmatchedAgentNames: string[];
  errors: { row: number; sheet: string; message: string }[];
};

function sheetRows(workbook: XLSX.WorkBook, name: string): Row[] {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
}

function findSheet(workbook: XLSX.WorkBook, matcher: (name: string) => boolean) {
  return workbook.SheetNames.find(matcher) ?? "";
}

function sheetArrayRows(workbook: XLSX.WorkBook, name: string): unknown[][] {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
}

function col(row: unknown[], index: number) {
  const value = row[index];
  if (value == null || String(value).trim() === "") return undefined;
  return value;
}
function getCell(row: Row, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== "") return row[key];
  }
  const normalizedEntries = Object.entries(row);
  for (const key of keys) {
    const target = key.trim().toLowerCase();
    const match = normalizedEntries.find(([k]) => k.trim().toLowerCase() === target);
    if (match && String(match[1]).trim() !== "") return match[1];
  }
  return undefined;
}

function combineNotes(...parts: unknown[]) {
  return parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join("\n---\n");
}

type TicketCounters = { created: number; skipped: number; updated: number };

async function upsertCaseTickets(
  unitId: string,
  agentId: string | null | undefined,
  cases: ImportCase[],
  counters: TicketCounters
) {
  for (const item of cases) {
    const notes = item.notes.trim();
    if (!notes) continue;

    const status = item.status ?? "PENDING";
    const useCanonical = CANONICAL_CASE_CATEGORIES.has(item.category);

    const existing = useCanonical
      ? await prisma.ticket.findFirst({
          where: { unitId, category: item.category },
          orderBy: { updatedAt: "desc" },
        })
      : await prisma.ticket.findFirst({
          where: { unitId, category: item.category, notes },
        });

    if (existing) {
      const changed =
        existing.notes !== notes ||
        existing.status !== status ||
        (!existing.agentId && !!agentId);

      if (changed) {
        await prisma.ticket.update({
          where: { id: existing.id },
          data: {
            notes,
            status,
            agentId: agentId ?? existing.agentId ?? undefined,
          },
        });
        counters.updated += 1;
      } else {
        counters.skipped += 1;
      }
      continue;
    }

    await prisma.ticket.create({
      data: {
        unitId,
        agentId: agentId ?? undefined,
        notes,
        category: item.category,
        status,
      },
    });
    counters.created += 1;
  }
}

async function ensureProject(name: string) {
  const normalized = normalizeProjectName(name);
  return prisma.project.upsert({
    where: { name: normalized },
    update: {},
    create: { name: normalized },
  });
}

async function ensureClient(name: string, phones?: string) {
  const { phone1, phone2 } = splitPhones(phones);
  const existing = await prisma.client.findFirst({
    where: {
      name: name.trim(),
      ...(phone1 ? { phone1 } : {}),
    },
  });
  if (existing) {
    return prisma.client.update({
      where: { id: existing.id },
      data: { phone1: phone1 ?? existing.phone1, phone2: phone2 ?? existing.phone2 },
    });
  }
  return prisma.client.create({
    data: { name: name.trim(), phone1, phone2 },
  });
}

type UnitKey = `${string}::${string}`;

function unitKey(project: string, unitCode: string): UnitKey {
  return `${normalizeProjectName(project)}::${normalizeUnitCode(unitCode)}`;
}

export async function ingestWorkbook(buffer: Buffer): Promise<ImportResult> {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const result: ImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    ticketsCreated: 0,
    ticketsUpdated: 0,
    ticketsSkipped: 0,
    agentsUnresolved: 0,
    unitsAssigned: 0,
    ticketsAssigned: 0,
    unmatchedAgentNames: [],
    errors: [],
  };
  const ticketCounters: TicketCounters = { created: 0, updated: 0, skipped: 0 };
  const agentResolver = await createAgentResolver();

  const masterName = findSheet(workbook, (n) => n.trim().toLowerCase().includes("njd 2026"));
  const finalName = findSheet(workbook, (n) => n.trim().toLowerCase() === "final");
  const greenFinishName = findSheet(workbook, (n) => n.includes("تشطيبات جرين"));
  const cancelledName = findSheet(workbook, (n) => n.includes("وحدات الفسخ"));
  const juraReadyName = findSheet(workbook, (n) => n.includes("جاهزيه وحدات JURA"));
  const greenReadyName = findSheet(workbook, (n) => n.includes("جاهزيه وحدات GREEN"));
  const warningsName = findSheet(workbook, (n) => n.includes("اعذارات"));

  const unitIdMap = new Map<UnitKey, string>();

  async function upsertUnitRecord(input: {
    projectName: string;
    unitCode: string;
    clientName?: string;
    phones?: string;
    type?: string;
    area?: unknown;
    category?: string;
    contractDate?: unknown;
    deliveryDate?: unknown;
    handoverStatus?: HandoverStatus;
    actionLabel?: string;
    agentName?: string;
    finishingType?: string;
    packageLabel?: string;
    companyName?: string;
    pricePerMeter?: unknown;
    totalPrice?: unknown;
    doorFees?: unknown;
    aluminumFees?: unknown;
    notes?: string;
    cases?: ImportCase[];
    ticketStatus?: "PENDING" | "ENGINEERING" | "LEGAL" | "RESOLVED";
  }) {
    if (!input.projectName || !input.unitCode || !input.clientName) {
      result.skipped += 1;
      return null;
    }

    const project = await ensureProject(input.projectName);
    const client = await ensureClient(input.clientName, input.phones);
    const agentId = input.agentName
      ? await agentResolver.resolve(input.agentName)
      : null;
    const code = normalizeUnitCode(input.unitCode);
    const key = unitKey(project.name, code);

    const existing = await prisma.unit.findUnique({
      where: { projectId_unitCode: { projectId: project.id, unitCode: code } },
    });

    const unit = await prisma.unit.upsert({
      where: { projectId_unitCode: { projectId: project.id, unitCode: code } },
      update: {
        type: mapUnitType(String(input.type ?? existing?.type ?? "APARTMENT")),
        area: parseLegacyNumber(input.area) ?? undefined,
        clientId: client.id,
        agentId: agentId ?? existing?.agentId ?? undefined,
        category: input.category ?? undefined,
      },
      create: {
        unitCode: code,
        projectId: project.id,
        type: mapUnitType(String(input.type ?? "")),
        area: parseLegacyNumber(input.area) ?? undefined,
        clientId: client.id,
        agentId: agentId ?? undefined,
        category: input.category,
      },
    });

    unitIdMap.set(key, unit.id);
    if (existing) result.updated += 1;
    else result.created += 1;

    const handoverStatus =
      input.handoverStatus ??
      mapHandoverStatus(input.actionLabel, String(input.type ?? ""));

    await prisma.contractWorkflow.upsert({
      where: { unitId: unit.id },
      update: {
        contractDate: parseLegacyDate(input.contractDate) ?? undefined,
        deliveryDate: parseLegacyDate(input.deliveryDate) ?? undefined,
        handoverStatus,
        actionLabel: input.actionLabel,
      },
      create: {
        unitId: unit.id,
        contractDate: parseLegacyDate(input.contractDate),
        deliveryDate: parseLegacyDate(input.deliveryDate),
        handoverStatus,
        actionLabel: input.actionLabel,
      },
    });

    const hasFinishing =
      input.finishingType ||
      input.packageLabel ||
      input.companyName ||
      input.pricePerMeter ||
      input.totalPrice ||
      input.doorFees ||
      input.aluminumFees;

    if (hasFinishing) {
      await prisma.finishing.upsert({
        where: { unitId: unit.id },
        update: {
          finishingType: mapFinishingType(String(input.finishingType ?? input.packageLabel ?? "")),
          packageLabel: input.packageLabel,
          companyName: input.companyName,
          pricePerMeter: parseLegacyNumber(input.pricePerMeter) ?? undefined,
          totalFinishingPrice: parseLegacyNumber(input.totalPrice) ?? undefined,
          doorFees: parseLegacyNumber(input.doorFees) ?? undefined,
          aluminumFees: parseLegacyNumber(input.aluminumFees) ?? undefined,
        },
        create: {
          unitId: unit.id,
          finishingType: mapFinishingType(String(input.finishingType ?? input.packageLabel ?? "")),
          packageLabel: input.packageLabel,
          companyName: input.companyName,
          pricePerMeter: parseLegacyNumber(input.pricePerMeter) ?? undefined,
          totalFinishingPrice: parseLegacyNumber(input.totalPrice) ?? undefined,
          doorFees: parseLegacyNumber(input.doorFees) ?? undefined,
          aluminumFees: parseLegacyNumber(input.aluminumFees) ?? undefined,
        },
      });
    }

    if (input.cases?.length) {
      await upsertCaseTickets(unit.id, agentId, input.cases, ticketCounters);
    } else if (input.notes) {
      await upsertCaseTickets(
        unit.id,
        agentId,
        [
          {
            notes: input.notes,
            category: "GENERAL",
            status: input.ticketStatus ?? "PENDING",
          },
        ],
        ticketCounters
      );
    }

    if (agentId) {
      await prisma.ticket.updateMany({
        where: { unitId: unit.id },
        data: { agentId },
      });
    }

    return unit;
  }

  const masterRows = masterName ? sheetArrayRows(workbook, masterName) : [];
  for (let i = 1; i < masterRows.length; i++) {
    const row = masterRows[i];
    try {
      const projectName = String(col(row, 1) ?? "").trim();
      const clientName = String(col(row, 3) ?? "").trim();
      const unitCode = col(row, 4);
      if (!projectName || !clientName || !unitCode) continue;

      await upsertUnitRecord({
        projectName,
        unitCode: String(unitCode),
        clientName,
        phones: String(col(row, 20) ?? ""),
        type: String(col(row, 5) ?? ""),
        area: col(row, 6),
        category: String(col(row, 23) ?? "") || undefined,
        contractDate: col(row, 2),
        deliveryDate: col(row, 7),
        actionLabel: String(col(row, 12) ?? "") || undefined,
        handoverStatus: mapHandoverStatus(
          String(col(row, 8) ?? ""),
          String(col(row, 9) ?? ""),
          String(col(row, 10) ?? ""),
          String(col(row, 12) ?? "")
        ),
        agentName: String(col(row, 13) ?? "") || undefined,
        finishingType: String(col(row, 17) ?? "") || undefined,
        totalPrice: col(row, 18),
        cases: buildMasterSheetCases(col(row, 14), col(row, 15), col(row, 16)),
      });
    } catch (error) {
      result.errors.push({
        row: i + 1,
        sheet: masterName,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const finalRows = finalName ? sheetRows(workbook, finalName) : [];
  for (let i = 0; i < finalRows.length; i++) {
    const row = finalRows[i];
    try {
      const projectName = String(getCell(row, "اسم المشروع", "PROJECT", "C") ?? "").trim();
      const clientName = String(getCell(row, "اسم العميل", "D") ?? "").trim();
      const unitCode = getCell(row, "رقم الوحده", "E");
      if (!projectName || !clientName || !unitCode) continue;

      await upsertUnitRecord({
        projectName,
        unitCode: String(unitCode),
        clientName,
        type: String(getCell(row, "النوع", "G") ?? ""),
        area: getCell(row, "مساحة الوحده", "F"),
        contractDate: getCell(row, "المؤرخ في", "H"),
        actionLabel: String(getCell(row, "النوع", "G") ?? "") || undefined,
        handoverStatus: mapHandoverStatus(String(getCell(row, "النوع", "G") ?? "")),
        agentName: String(getCell(row, "المسئول", "B") ?? "") || undefined,
        companyName: String(getCell(row, "الشركة المسئوله عن التشطيبات", "I") ?? "") || undefined,
        pricePerMeter: getCell(row, "سعر باقة التشطيب للمتر", "M"),
        totalPrice: getCell(row, "اجمالي السعر", "N"),
        doorFees: getCell(row, "مصاريف باب", "J"),
        aluminumFees: getCell(row, "مصاريف الوميتال", "K"),
        notes: String(getCell(row, "ملاحظات", "O") ?? "") || undefined,
      });
    } catch (error) {
      result.errors.push({
        row: i + 2,
        sheet: finalName,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const greenRows = greenFinishName ? sheetRows(workbook, greenFinishName) : [];
  for (let i = 0; i < greenRows.length; i++) {
    const row = greenRows[i];
    try {
      const projectName = String(getCell(row, "اسم المشروع", "D") ?? "GREEN AVENUE").trim();
      const clientName = String(getCell(row, "اسم العميل", "E") ?? "").trim();
      const unitCode = getCell(row, "رقم الوحده", "F");
      if (!clientName || !unitCode) continue;

      await upsertUnitRecord({
        projectName,
        unitCode: String(unitCode),
        clientName,
        area: getCell(row, "مساحة الوحده", "G"),
        packageLabel: String(getCell(row, "نوع الباقه", "H") ?? "") || undefined,
        contractDate: getCell(row, "المؤرخ في", "I"),
        companyName: String(getCell(row, "الشركة المسئوله عن التشطيبات", "J") ?? "") || undefined,
        pricePerMeter: getCell(row, "سعر باقة التشطيب للمتر", "L"),
        totalPrice: getCell(row, "اجمالي السعر", "M"),
        doorFees: getCell(row, "مصاريف باب", "N"),
        aluminumFees: getCell(row, "مصاريف الوميتال", "O"),
        agentName: String(getCell(row, "المسئول", "C") ?? "") || undefined,
        notes: String(getCell(row, "ملاحظات", "P") ?? "") || undefined,
      });
    } catch (error) {
      result.errors.push({
        row: i + 2,
        sheet: greenFinishName,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const cancelledRows = cancelledName ? sheetRows(workbook, cancelledName) : [];
  for (let i = 0; i < cancelledRows.length; i++) {
    const row = cancelledRows[i];
    try {
      const projectName = String(getCell(row, "PROJECT", "B") ?? "").trim();
      const clientName = String(getCell(row, "Name", "D") ?? "").trim();
      const unitCode = getCell(row, " Unit Code", "Unit Code", "E");
      if (!projectName || !clientName || !unitCode) continue;

      await upsertUnitRecord({
        projectName,
        unitCode: String(unitCode),
        clientName,
        type: String(getCell(row, "Type", "F") ?? ""),
        area: getCell(row, "Area", "G"),
        handoverStatus: "CANCELLED",
        actionLabel: String(getCell(row, "ACTION", "H") ?? "") || undefined,
        agentName: String(getCell(row, "__EMPTY", "المسئول") ?? "") || undefined,
        cases: [
          ...(String(getCell(row, "COMMENT", "J") ?? "").trim()
            ? [
                {
                  notes: String(getCell(row, "COMMENT", "J")),
                  category: "GENERAL" as const,
                  status: "PENDING" as const,
                },
              ]
            : []),
          ...(String(getCell(row, "ACTION", "H") ?? "").trim()
            ? [
                {
                  notes: `Action: ${String(getCell(row, "ACTION", "H"))}`,
                  category: "CUSTOMER_SERVICE" as const,
                  status: "PENDING" as const,
                },
              ]
            : []),
        ],
      });
    } catch (error) {
      result.errors.push({
        row: i + 2,
        sheet: cancelledName,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  for (const [sheetName, status] of [
    [juraReadyName, "PENDING"],
    [greenReadyName, "PENDING"],
  ] as const) {
    if (!sheetName) continue;
    const rows = sheetRows(workbook, sheetName);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const projectName = String(getCell(row, "PROJECT", "اسم المشروع", "C", "D") ?? "").trim();
        const clientName = String(getCell(row, "CLIENT NAME", "اسم العميل", "D", "E") ?? "").trim();
        const unitCode = getCell(row, "UNIT NO.", "رقم الوحده", "E", "F");
        if (!projectName || !clientName || !unitCode) continue;

        await upsertUnitRecord({
          projectName,
          unitCode: String(unitCode),
          clientName,
          area: getCell(row, "مساحة الوحده", "F", "G"),
          packageLabel: String(getCell(row, "Finishing", "نوع الباقه", "H") ?? "") || undefined,
          agentName: String(getCell(row, "CS", "المسئول", "C", "I") ?? "") || undefined,
          notes: String(getCell(row, "ملاحظات", "J", "L") ?? "") || undefined,
        });
      } catch (error) {
        result.errors.push({
          row: i + 2,
          sheet: sheetName,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  if (warningsName) {
    const rows = sheetRows(workbook, warningsName);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const clientName = String(getCell(row, "اسم العميل", "B") ?? "").trim();
        const unitCode = getCell(row, "رقم الوحده", "C");
        const notes = String(getCell(row, "الملاحظه", "F") ?? "Legal notice imported") || "Legal notice imported";
        if (!clientName || !unitCode) continue;

        const unit = await prisma.unit.findFirst({
          where: {
            unitCode: normalizeUnitCode(String(unitCode)),
            client: { name: clientName },
          },
        });
        if (!unit) continue;

        await upsertCaseTickets(
          unit.id,
          await agentResolver.resolve(String(getCell(row, "المسئول", "E") ?? "")),
          [
            {
              notes,
              category: "LEGAL",
              status: "LEGAL",
            },
          ],
          ticketCounters
        );
      } catch (error) {
        result.errors.push({
          row: i + 2,
          sheet: warningsName,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  result.ticketsCreated = ticketCounters.created;
  result.ticketsUpdated = ticketCounters.updated;
  result.ticketsSkipped = ticketCounters.skipped;

  const assignmentSync = await syncAssignmentsFromWorkbook(buffer);
  result.unitsAssigned = assignmentSync.unitsAssigned;
  result.ticketsAssigned = assignmentSync.ticketsAssigned;
  result.agentsUnresolved = assignmentSync.agentsUnresolved;
  result.unmatchedAgentNames = assignmentSync.unmatchedAgentNames;

  return result;
}
