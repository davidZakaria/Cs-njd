import * as XLSX from "xlsx";
import { basePrisma as prisma } from "@/lib/prisma";
import { createAgentResolver } from "@/lib/import/agents";
import {
  IMPORT_COLUMN_HEADERS,
  mapExecutingCompany,
  mapFinishingPackage,
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

function buildHeaderIndex(headerRow: unknown[]) {
  const map = new Map<string, number>();
  headerRow.forEach((cell, index) => {
    const key = String(cell ?? "").trim().toLowerCase();
    if (key) map.set(key, index);
  });
  return map;
}

function colByHeader(
  row: unknown[],
  headerIndex: Map<string, number>,
  ...keys: string[]
) {
  for (const key of keys) {
    const index = headerIndex.get(key.trim().toLowerCase());
    if (index == null) continue;
    const value = col(row, index);
    if (value !== undefined) return value;
  }
  return undefined;
}

function cellString(row: Row, ...keys: string[]) {
  const value = getCell(row, ...keys);
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

function optionalString(value: unknown) {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
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

async function ensureClient(
  name: string,
  phones?: string,
  address1?: string,
  address2?: string
) {
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
      data: {
        phone1: phone1 ?? existing.phone1,
        phone2: phone2 ?? existing.phone2,
        address1: address1 ?? existing.address1,
        address2: address2 ?? existing.address2,
      },
    });
  }
  return prisma.client.create({
    data: {
      name: name.trim(),
      phone1,
      phone2,
      address1: address1 ?? null,
      address2: address2 ?? null,
    },
  });
}

type UnitKey = `${string}::${string}`;

function unitKey(project: string, unitCode: string): UnitKey {
  return `${normalizeProjectName(project)}::${normalizeUnitCode(unitCode)}`;
}

type FinishingImportPatch = {
  finishingType?: ReturnType<typeof mapFinishingType>;
  packageType?: ReturnType<typeof mapFinishingPackage>;
  executingCompany?: ReturnType<typeof mapExecutingCompany>;
  packageLabel?: string | null;
  companyName?: string | null;
  contractDate?: Date | null;
  datedAt?: Date | null;
  emailDate?: Date | null;
  pricePerMeter?: number | null;
  totalFinishingPrice?: number | null;
  doorFees?: number | null;
  aluminumFees?: number | null;
  currentFinishingStatus?: string | null;
};

function hasPresentValue(value: unknown) {
  return value != null && String(value).trim() !== "";
}

function buildFinishingFields(input: {
  finishingType?: string;
  packageLabel?: string;
  companyName?: string;
  finishingContractDate?: unknown;
  datedAt?: unknown;
  emailDate?: unknown;
  pricePerMeter?: unknown;
  totalPrice?: unknown;
  doorFees?: unknown;
  aluminumFees?: unknown;
  currentFinishingStatus?: string;
}): FinishingImportPatch | null {
  const patch: FinishingImportPatch = {};
  const packageSource = input.packageLabel ?? input.finishingType;

  if (hasPresentValue(packageSource)) {
    patch.finishingType = mapFinishingType(String(packageSource));
    patch.packageType = mapFinishingPackage(String(packageSource)) ?? undefined;
  }
  if (input.packageLabel !== undefined) {
    patch.packageLabel = input.packageLabel.trim() || null;
  }
  if (input.companyName !== undefined) {
    const companyName = input.companyName.trim() || null;
    patch.companyName = companyName;
    patch.executingCompany = mapExecutingCompany(companyName ?? undefined) ?? undefined;
  }
  if (hasPresentValue(input.finishingContractDate)) {
    patch.contractDate = parseLegacyDate(input.finishingContractDate);
  }
  if (hasPresentValue(input.datedAt)) {
    patch.datedAt = parseLegacyDate(input.datedAt);
  }
  if (hasPresentValue(input.emailDate)) {
    patch.emailDate = parseLegacyDate(input.emailDate);
  }
  if (hasPresentValue(input.pricePerMeter)) {
    patch.pricePerMeter = parseLegacyNumber(input.pricePerMeter);
  }
  if (hasPresentValue(input.totalPrice)) {
    patch.totalFinishingPrice = parseLegacyNumber(input.totalPrice);
  }
  if (hasPresentValue(input.doorFees)) {
    patch.doorFees = parseLegacyNumber(input.doorFees);
  }
  if (hasPresentValue(input.aluminumFees)) {
    patch.aluminumFees = parseLegacyNumber(input.aluminumFees);
  }
  if (input.currentFinishingStatus !== undefined) {
    patch.currentFinishingStatus =
      input.currentFinishingStatus.trim() || null;
  }

  return Object.keys(patch).length > 0 ? patch : null;
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
    address1?: string;
    address2?: string;
    type?: string;
    area?: unknown;
    deliveryYear?: string;
    gracePeriod?: string;
    category?: string;
    contractDate?: unknown;
    deliveryDate?: unknown;
    handoverStatus?: HandoverStatus;
    actionLabel?: string;
    agentName?: string;
    finishingType?: string;
    packageLabel?: string;
    companyName?: string;
    finishingContractDate?: unknown;
    datedAt?: unknown;
    emailDate?: unknown;
    pricePerMeter?: unknown;
    totalPrice?: unknown;
    doorFees?: unknown;
    aluminumFees?: unknown;
    currentFinishingStatus?: string;
    notes?: string;
    cases?: ImportCase[];
    ticketStatus?: "PENDING" | "ENGINEERING" | "LEGAL" | "RESOLVED";
  }) {
    if (!input.projectName || !input.unitCode || !input.clientName) {
      result.skipped += 1;
      return null;
    }

    const project = await ensureProject(input.projectName);
    const client = await ensureClient(
      input.clientName,
      input.phones,
      input.address1,
      input.address2
    );
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
        deliveryYear: input.deliveryYear ?? undefined,
        gracePeriod: input.gracePeriod ?? undefined,
        clientId: client.id,
        agentId: agentId ?? existing?.agentId ?? undefined,
        category: input.category ?? undefined,
      },
      create: {
        unitCode: code,
        projectId: project.id,
        type: mapUnitType(String(input.type ?? "")),
        area: parseLegacyNumber(input.area) ?? undefined,
        deliveryYear: input.deliveryYear ?? null,
        gracePeriod: input.gracePeriod ?? null,
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

    const finishingFields = buildFinishingFields({
      finishingType: input.finishingType,
      packageLabel: input.packageLabel,
      companyName: input.companyName,
      finishingContractDate: input.finishingContractDate,
      datedAt: input.datedAt,
      emailDate: input.emailDate,
      pricePerMeter: input.pricePerMeter,
      totalPrice: input.totalPrice,
      doorFees: input.doorFees,
      aluminumFees: input.aluminumFees,
      currentFinishingStatus: input.currentFinishingStatus,
    });

    if (finishingFields) {
      await prisma.finishing.upsert({
        where: { unitId: unit.id },
        update: finishingFields,
        create: {
          unitId: unit.id,
          finishingType: finishingFields.finishingType ?? "CUSTOM",
          ...finishingFields,
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
  const masterHeader = masterRows[0] ?? [];
  const masterCols = buildHeaderIndex(masterHeader);
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
        address1: optionalString(
          colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.address1)
        ),
        address2: optionalString(
          colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.address2)
        ),
        type:
          optionalString(colByHeader(row, masterCols, "النوع", "Type")) ??
          String(col(row, 5) ?? ""),
        area: colByHeader(row, masterCols, "مساحة الوحده", "Area") ?? col(row, 6),
        deliveryYear: optionalString(
          colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.deliveryYear)
        ),
        gracePeriod: optionalString(
          colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.gracePeriod)
        ),
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
        packageLabel:
          optionalString(
            colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.packageType)
          ) ?? undefined,
        companyName:
          optionalString(
            colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.executingCompany)
          ) ?? undefined,
        finishingContractDate:
          colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.contractDate) ??
          undefined,
        pricePerMeter:
          colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.pricePerMeter) ??
          undefined,
        totalPrice:
          colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.totalFinishing) ??
          col(row, 18),
        doorFees:
          colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.doorFees) ??
          undefined,
        aluminumFees:
          colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.aluminumFees) ??
          undefined,
        currentFinishingStatus: optionalString(
          colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.currentFinishingStatus)
        ),
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
        address1: cellString(row, ...IMPORT_COLUMN_HEADERS.address1),
        address2: cellString(row, ...IMPORT_COLUMN_HEADERS.address2),
        deliveryYear: cellString(row, ...IMPORT_COLUMN_HEADERS.deliveryYear),
        gracePeriod: cellString(row, ...IMPORT_COLUMN_HEADERS.gracePeriod),
        type: String(getCell(row, "النوع", "G") ?? ""),
        area: getCell(row, "مساحة الوحده", "F"),
        actionLabel: String(getCell(row, "النوع", "G") ?? "") || undefined,
        handoverStatus: mapHandoverStatus(String(getCell(row, "النوع", "G") ?? "")),
        agentName: String(getCell(row, "المسئول", "B") ?? "") || undefined,
        packageLabel: cellString(row, ...IMPORT_COLUMN_HEADERS.packageType),
        companyName: cellString(row, ...IMPORT_COLUMN_HEADERS.executingCompany),
        finishingContractDate: getCell(
          row,
          ...IMPORT_COLUMN_HEADERS.contractDate
        ),
        datedAt: getCell(row, "المؤرخ في", "H"),
        emailDate: getCell(
          row,
          "تاريخ ارسال الايميل",
          "تاريخ إرسال الإيميل",
          "تاريخ ارسال الإيميل"
        ),
        pricePerMeter: getCell(row, ...IMPORT_COLUMN_HEADERS.pricePerMeter),
        totalPrice: getCell(row, ...IMPORT_COLUMN_HEADERS.totalFinishing),
        doorFees: getCell(row, ...IMPORT_COLUMN_HEADERS.doorFees),
        aluminumFees: getCell(row, ...IMPORT_COLUMN_HEADERS.aluminumFees),
        currentFinishingStatus: cellString(
          row,
          ...IMPORT_COLUMN_HEADERS.currentFinishingStatus
        ),
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
        address1: cellString(row, ...IMPORT_COLUMN_HEADERS.address1),
        address2: cellString(row, ...IMPORT_COLUMN_HEADERS.address2),
        deliveryYear: cellString(row, ...IMPORT_COLUMN_HEADERS.deliveryYear),
        gracePeriod: cellString(row, ...IMPORT_COLUMN_HEADERS.gracePeriod),
        area: getCell(row, "مساحة الوحده", "G"),
        packageLabel: cellString(row, ...IMPORT_COLUMN_HEADERS.packageType),
        datedAt: getCell(row, "المؤرخ في", "I"),
        finishingContractDate: getCell(
          row,
          ...IMPORT_COLUMN_HEADERS.contractDate
        ),
        emailDate: getCell(
          row,
          "تاريخ ارسال الايميل",
          "تاريخ إرسال الإيميل",
          "تاريخ ارسال الإيميل"
        ),
        companyName: cellString(row, ...IMPORT_COLUMN_HEADERS.executingCompany),
        pricePerMeter: getCell(row, ...IMPORT_COLUMN_HEADERS.pricePerMeter),
        totalPrice: getCell(row, ...IMPORT_COLUMN_HEADERS.totalFinishing),
        doorFees: getCell(row, ...IMPORT_COLUMN_HEADERS.doorFees),
        aluminumFees: getCell(row, ...IMPORT_COLUMN_HEADERS.aluminumFees),
        currentFinishingStatus: cellString(
          row,
          ...IMPORT_COLUMN_HEADERS.currentFinishingStatus
        ),
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
          address1: cellString(row, ...IMPORT_COLUMN_HEADERS.address1),
          address2: cellString(row, ...IMPORT_COLUMN_HEADERS.address2),
          deliveryYear: cellString(row, ...IMPORT_COLUMN_HEADERS.deliveryYear),
          gracePeriod: cellString(row, ...IMPORT_COLUMN_HEADERS.gracePeriod),
          area: getCell(row, "مساحة الوحده", "F", "G"),
          packageLabel: cellString(row, ...IMPORT_COLUMN_HEADERS.packageType),
          companyName: cellString(row, ...IMPORT_COLUMN_HEADERS.executingCompany),
          finishingContractDate: getCell(
            row,
            ...IMPORT_COLUMN_HEADERS.contractDate
          ),
          datedAt: getCell(row, "المؤرخ في"),
          emailDate: getCell(
            row,
            "تاريخ ارسال الايميل",
            "تاريخ إرسال الإيميل"
          ),
          pricePerMeter: getCell(row, ...IMPORT_COLUMN_HEADERS.pricePerMeter),
          totalPrice: getCell(row, ...IMPORT_COLUMN_HEADERS.totalFinishing),
          doorFees: getCell(row, ...IMPORT_COLUMN_HEADERS.doorFees),
          aluminumFees: getCell(row, ...IMPORT_COLUMN_HEADERS.aluminumFees),
          currentFinishingStatus: cellString(
            row,
            ...IMPORT_COLUMN_HEADERS.currentFinishingStatus
          ),
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
