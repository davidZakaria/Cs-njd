import * as XLSX from "xlsx";
import { basePrisma as prisma } from "@/lib/prisma";
import { createAgentResolver } from "@/lib/import/agents";
import {
  IMPORT_COLUMN_HEADERS,
  mapExecutingCompany,
  mapFinishingPhase,
  resolveExecutingCompanyLabel,
  mapFinishingPackage,
  mapFinishingType,
  mapHandoverStatus,
  mapUnitType,
} from "@/lib/import/columns";
import { parseLegacyDate } from "@/lib/import/dates";
import { parseLegacyNumber } from "@/lib/import/numbers";
import {
  normalizeUnitCode,
  normalizeHeader,
  splitPhones,
} from "@/lib/import/sanitize";
import {
  buildMasterSheetCases,
  CANONICAL_CASE_CATEGORIES,
  type ImportCase,
} from "@/lib/import/master-cases";
import {
  deriveHandoverChecklist,
  type ImportGateContext,
  reconcileImportCaseStatus,
} from "@/lib/import/workflow-sync";
import { deriveEdgeCasesFromLegacyText } from "@/lib/import/edge-case-sync";
import { resolveImportProjectName } from "@/lib/import/project-names";
import type { FinishingPhase, HandoverStatus, PendingParty } from "@prisma/client";
import { syncAssignmentsFromWorkbook } from "@/lib/import/sync-assignments";

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
  edgeCasesFlagged: number;
  errors: { row: number; sheet: string; message: string }[];
};

export type IngestWorkbookOptions = {
  runAssignmentSync?: boolean;
};

export function mergeImportResults(
  base: ImportResult,
  partial: ImportResult
): ImportResult {
  const unmatched = new Set([
    ...base.unmatchedAgentNames,
    ...partial.unmatchedAgentNames,
  ]);
  return {
    created: base.created + partial.created,
    updated: base.updated + partial.updated,
    skipped: base.skipped + partial.skipped,
    ticketsCreated: base.ticketsCreated + partial.ticketsCreated,
    ticketsUpdated: base.ticketsUpdated + partial.ticketsUpdated,
    ticketsSkipped: base.ticketsSkipped + partial.ticketsSkipped,
    agentsUnresolved: base.agentsUnresolved + partial.agentsUnresolved,
    unitsAssigned: base.unitsAssigned + partial.unitsAssigned,
    ticketsAssigned: base.ticketsAssigned + partial.ticketsAssigned,
    unmatchedAgentNames: [...unmatched],
    edgeCasesFlagged: base.edgeCasesFlagged + partial.edgeCasesFlagged,
    errors: [...base.errors, ...partial.errors],
  };
}

function emptyImportResult(): ImportResult {
  return {
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
    edgeCasesFlagged: 0,
    errors: [],
  };
}

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

type TicketCounters = { created: number; skipped: number; updated: number };

async function loadImportGateContext(unitId: string): Promise<ImportGateContext> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { finishing: true, contractWorkflow: true },
  });

  if (!unit) {
    return { finishing: null, contractWorkflow: null };
  }

  return {
    finishing: unit.finishing
      ? {
          phases: unit.finishing.phases?.length
            ? unit.finishing.phases
            : unit.finishing.phase
              ? [unit.finishing.phase]
              : [],
          doorFees: unit.finishing.doorFees,
          aluminumFees: unit.finishing.aluminumFees,
        }
      : null,
    contractWorkflow: unit.contractWorkflow
      ? {
          hasSignedProtocol: unit.contractWorkflow.hasSignedProtocol,
          hasSignedExtension: unit.contractWorkflow.hasSignedExtension,
          hasPaidFees: unit.contractWorkflow.hasPaidFees,
          papersReceived: unit.contractWorkflow.papersReceived,
          handoverStatus: unit.contractWorkflow.handoverStatus,
        }
      : null,
  };
}

async function upsertCaseTickets(
  unitId: string,
  agentId: string | null | undefined,
  cases: ImportCase[],
  counters: TicketCounters,
  gateContext?: ImportGateContext
) {
  for (const item of cases) {
    const notes = item.notes.trim();
    if (!notes) continue;

    const proposedStatus = item.status ?? "PENDING";
    const useCanonical = CANONICAL_CASE_CATEGORIES.has(item.category);

    const existing = useCanonical
      ? await prisma.ticket.findFirst({
          where: { unitId, category: item.category },
          orderBy: { updatedAt: "desc" },
        })
      : await prisma.ticket.findFirst({
          where: { unitId, category: item.category, notes },
        });

    const reconciled = gateContext
      ? reconcileImportCaseStatus(
          proposedStatus,
          notes,
          gateContext,
          existing?.pendingParty
        )
      : {
          status: proposedStatus,
          pendingParty: (existing?.pendingParty ?? "NONE") as PendingParty,
        };
    const { status, pendingParty } = reconciled;

    if (existing) {
      const changed =
        existing.notes !== notes ||
        existing.status !== status ||
        existing.pendingParty !== pendingParty ||
        (!existing.agentId && !!agentId);

      if (changed) {
        await prisma.ticket.update({
          where: { id: existing.id },
          data: {
            notes,
            status,
            pendingParty,
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
        pendingParty,
      },
    });
    counters.created += 1;
  }
}

async function ensureProject(name: string) {
  const normalized = resolveImportProjectName(name);
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
  return `${resolveImportProjectName(project)}::${normalizeUnitCode(unitCode)}`;
}

function formatGracePeriod(value: unknown): string | undefined {
  if (value == null || String(value).trim() === "") return undefined;
  const raw = String(value).trim();
  if (/^\d+(\.0)?$/.test(raw)) return raw.replace(/\.0$/, "");
  return raw;
}

function deliveryYearFromValue(
  deliveryDate: unknown,
  yearColumn?: unknown
): string | undefined {
  const yearRaw = yearColumn != null ? String(yearColumn).trim() : "";
  if (yearRaw && /^\d{4}$/.test(yearRaw.replace(/\.0$/, ""))) {
    return yearRaw.replace(/\.0$/, "");
  }
  const parsed = parseLegacyDate(deliveryDate);
  return parsed ? String(parsed.getFullYear()) : undefined;
}

function findDeliveryDataHeaderRow(rows: unknown[][]) {
  return rows.findIndex((row) =>
    row.some((cell) =>
      normalizeHeader(String(cell ?? "")).includes("unit code")
    )
  );
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
  phase?: ReturnType<typeof mapFinishingPhase>;
  phases?: FinishingPhase[];
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
  notes?: string;
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

  const phaseSource = [input.currentFinishingStatus, input.notes]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (phaseSource) {
    const phase = mapFinishingPhase(phaseSource);
    if (phase) {
      patch.phase = phase;
      patch.phases = [phase];
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export async function ingestWorkbook(
  buffer: Buffer,
  options: IngestWorkbookOptions = {}
): Promise<ImportResult> {
  const runAssignmentSync = options.runAssignmentSync ?? true;
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
    edgeCasesFlagged: 0,
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
  const jamilaName = findSheet(workbook, (n) => n.trim().toLowerCase() === "jamila");
  const deliveryDataName = findSheet(workbook, (n) => n.trim().toLowerCase() === "data");

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
    handoverRaw?: unknown;
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

    const doorFeesAmount = parseLegacyNumber(input.doorFees);
    const aluminumFeesAmount = parseLegacyNumber(input.aluminumFees);
    const checklist = deriveHandoverChecklist({
      handoverRaw: input.handoverRaw ?? input.actionLabel,
      handoverStatus,
      doorFees: doorFeesAmount,
      aluminumFees: aluminumFeesAmount,
      actionLabel: input.actionLabel,
    });

    const caseNotes =
      input.cases
        ?.map((entry) => entry.notes)
        .filter(Boolean)
        .join("\n") ?? "";
    const edgeCaseText = [
      input.notes,
      input.actionLabel,
      String(input.handoverRaw ?? ""),
      caseNotes,
    ]
      .filter(Boolean)
      .join("\n");
    const edgeCases = deriveEdgeCasesFromLegacyText(edgeCaseText);
    const hasEdgeCases = Object.keys(edgeCases).length > 0;
    if (hasEdgeCases) {
      result.edgeCasesFlagged += 1;
    }

    const workflowEdgePatch: {
      isLegallyBlocked?: boolean;
      powerOfAttorneyReceived?: boolean;
    } = {};
    if (edgeCases.isLegallyBlocked !== undefined) {
      workflowEdgePatch.isLegallyBlocked = edgeCases.isLegallyBlocked;
    }
    if (edgeCases.powerOfAttorneyReceived !== undefined) {
      workflowEdgePatch.powerOfAttorneyReceived = edgeCases.powerOfAttorneyReceived;
    }

    await prisma.contractWorkflow.upsert({
      where: { unitId: unit.id },
      update: {
        contractDate: parseLegacyDate(input.contractDate) ?? undefined,
        deliveryDate: parseLegacyDate(input.deliveryDate) ?? undefined,
        handoverStatus,
        actionLabel: input.actionLabel,
        ...checklist,
        ...workflowEdgePatch,
      },
      create: {
        unitId: unit.id,
        contractDate: parseLegacyDate(input.contractDate),
        deliveryDate: parseLegacyDate(input.deliveryDate),
        handoverStatus,
        actionLabel: input.actionLabel,
        ...checklist,
        ...workflowEdgePatch,
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
      notes: input.notes,
    });

    if (finishingFields) {
      const finishingEdgePatch: {
        customModifications?: string | null;
        modificationsCompleted?: boolean;
      } = {};
      if (edgeCases.customModifications !== undefined) {
        finishingEdgePatch.customModifications = edgeCases.customModifications;
      }
      if (edgeCases.modificationsCompleted !== undefined) {
        finishingEdgePatch.modificationsCompleted = edgeCases.modificationsCompleted;
      }

      await prisma.finishing.upsert({
        where: { unitId: unit.id },
        update: {
          ...finishingFields,
          ...finishingEdgePatch,
        },
        create: {
          unitId: unit.id,
          finishingType: finishingFields.finishingType ?? "CUSTOM",
          ...finishingFields,
          ...finishingEdgePatch,
        },
      });
    } else if (
      edgeCases.customModifications !== undefined ||
      edgeCases.modificationsCompleted !== undefined
    ) {
      await prisma.finishing.upsert({
        where: { unitId: unit.id },
        update: {
          customModifications: edgeCases.customModifications ?? null,
          modificationsCompleted: edgeCases.modificationsCompleted ?? true,
        },
        create: {
          unitId: unit.id,
          finishingType: "CUSTOM",
          customModifications: edgeCases.customModifications ?? null,
          modificationsCompleted: edgeCases.modificationsCompleted ?? true,
        },
      });
    }

    const resolvedPhases =
      finishingFields?.phases?.filter(
        (phase): phase is NonNullable<typeof phase> => phase != null
      ) ??
      (finishingFields?.phase ? [finishingFields.phase] : []);

    const gateContext: ImportGateContext = {
      finishing: finishingFields
        ? {
            phases: resolvedPhases,
            doorFees: doorFeesAmount,
            aluminumFees: aluminumFeesAmount,
            customModifications:
              edgeCases.customModifications ?? null,
            modificationsCompleted:
              edgeCases.modificationsCompleted ?? true,
          }
        : doorFeesAmount != null || aluminumFeesAmount != null
          ? {
              phases: [],
              doorFees: doorFeesAmount,
              aluminumFees: aluminumFeesAmount,
              customModifications: edgeCases.customModifications,
              modificationsCompleted: edgeCases.modificationsCompleted,
            }
          : edgeCases.customModifications !== undefined ||
              edgeCases.modificationsCompleted !== undefined
            ? {
                phases: [],
                doorFees: null,
                aluminumFees: null,
                customModifications: edgeCases.customModifications,
                modificationsCompleted: edgeCases.modificationsCompleted,
              }
            : null,
      contractWorkflow: {
        ...checklist,
        handoverStatus,
        isLegallyBlocked: edgeCases.isLegallyBlocked,
      },
    };

    if (input.cases?.length) {
      await upsertCaseTickets(
        unit.id,
        agentId,
        input.cases,
        ticketCounters,
        gateContext
      );
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
        ticketCounters,
        gateContext
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
        handoverRaw: col(row, 8),
        handoverStatus: mapHandoverStatus(
          String(col(row, 8) ?? ""),
          String(col(row, 9) ?? ""),
          String(col(row, 10) ?? ""),
          String(col(row, 12) ?? "")
        ),
        agentName: String(col(row, 14) ?? "") || undefined,
        finishingType: String(col(row, 17) ?? "") || undefined,
        packageLabel:
          optionalString(
            colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.packageType)
          ) ?? undefined,
        companyName: resolveExecutingCompanyLabel(
          colByHeader(row, masterCols, ...IMPORT_COLUMN_HEADERS.executingCompany),
          col(row, 10)
        ),
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
        cases: buildMasterSheetCases({
          handoverRaw: col(row, 8),
          actionRaw: col(row, 13),
          customerServiceRaw: col(row, 15),
          feedbackOldRaw: col(row, 16),
          legalRaw: col(row, 21),
          warningsRaw: col(row, 22),
          engineeringRaw: col(row, 24),
        }),
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
        companyName: resolveExecutingCompanyLabel(
          cellString(row, ...IMPORT_COLUMN_HEADERS.executingCompany),
          cellString(row, "تشطيب")
        ),
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
        companyName: resolveExecutingCompanyLabel(
          cellString(row, ...IMPORT_COLUMN_HEADERS.executingCompany),
          cellString(row, "تشطيب")
        ),
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

  for (const [sheetName, _status] of [
    [juraReadyName, "PENDING"],
    [greenReadyName, "PENDING"],
  ] as const) {
    if (!sheetName) continue;
    const arrayRows = sheetArrayRows(workbook, sheetName);
    const objectRows = sheetRows(workbook, sheetName);
    for (let i = 0; i < objectRows.length; i++) {
      const row = objectRows[i];
      const arrayRow = arrayRows[i + 1] ?? [];
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
          companyName: resolveExecutingCompanyLabel(
            cellString(row, ...IMPORT_COLUMN_HEADERS.executingCompany),
            col(arrayRow, 9)
          ),
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

  if (jamilaName) {
    const jamilaRows = sheetRows(workbook, jamilaName);
    for (let i = 0; i < jamilaRows.length; i++) {
      const row = jamilaRows[i];
      try {
        const projectName = String(getCell(row, "Project", "project") ?? "Jamila").trim();
        const clientName = String(getCell(row, "Name", "name") ?? "").trim();
        const unitCode = getCell(row, "Unit Code", "unit code");
        if (!clientName || !unitCode) continue;

        const deliveryDate = getCell(row, "Delivery Date Updated", "delivery date updated");
        const gracePeriod = formatGracePeriod(
          getCell(row, "Grace Period", "grace period")
        );
        const finishingRaw = String(getCell(row, "Finishing", "finishing") ?? "");

        await upsertUnitRecord({
          projectName,
          unitCode: String(unitCode),
          clientName,
          phones: String(getCell(row, "mobile", "Mobile", "Mobile Number") ?? ""),
          type: String(getCell(row, "Type", "type") ?? ""),
          area: getCell(row, "Contract area", "contract area"),
          contractDate: getCell(row, "Contract Date", "contract date"),
          deliveryDate,
          gracePeriod,
          deliveryYear: deliveryYearFromValue(
            deliveryDate,
            getCell(row, "YEAR", "Year")
          ),
          finishingType: finishingRaw || undefined,
          packageLabel: finishingRaw || undefined,
          notes: String(getCell(row, "NOTE", "Note", "note") ?? "") || undefined,
          handoverStatus: mapHandoverStatus(finishingRaw),
        });
      } catch (error) {
        result.errors.push({
          row: i + 2,
          sheet: jamilaName,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  if (deliveryDataName) {
    const arrayRows = sheetArrayRows(workbook, deliveryDataName);
    const headerRowIndex = findDeliveryDataHeaderRow(arrayRows);
    if (headerRowIndex >= 0) {
      const header = arrayRows[headerRowIndex] ?? [];
      const deliveryCols = buildHeaderIndex(header);
      for (let i = headerRowIndex + 1; i < arrayRows.length; i++) {
        const row = arrayRows[i] ?? [];
        try {
          const projectName = String(
            colByHeader(row, deliveryCols, "project", "project name") ?? ""
          ).trim();
          const clientName = String(colByHeader(row, deliveryCols, "name") ?? "").trim();
          const unitCode = colByHeader(row, deliveryCols, "unit code");
          if (!projectName || !clientName || !unitCode) continue;

          const deliveryDate = colByHeader(
            row,
            deliveryCols,
            "delivery date updated",
            "delivery date"
          );
          const gracePeriod = formatGracePeriod(
            colByHeader(row, deliveryCols, "grace period")
          );
          const finishingRaw = String(
            colByHeader(row, deliveryCols, "finishing (requested)", "finishing") ?? ""
          );
          const handoverHint = colByHeader(
            row,
            deliveryCols,
            "التوصيات المطلوبة",
            "note"
          );
          const extensionHint = colByHeader(row, deliveryCols, "2", "3", "4", "5");

          await upsertUnitRecord({
            projectName,
            unitCode: String(unitCode),
            clientName,
            type: String(colByHeader(row, deliveryCols, "type") ?? ""),
            area:
              colByHeader(row, deliveryCols, "contract area", "area") ?? undefined,
            contractDate: colByHeader(row, deliveryCols, "contract date"),
            deliveryDate,
            gracePeriod,
            deliveryYear: deliveryYearFromValue(
              deliveryDate,
              colByHeader(row, deliveryCols, "year")
            ),
            finishingType: finishingRaw || undefined,
            packageLabel: finishingRaw || undefined,
            agentName:
              String(
                colByHeader(
                  row,
                  deliveryCols,
                  "responsible",
                  "cs",
                  "eng responsible"
                ) ?? ""
              ).trim() || undefined,
            handoverRaw: handoverHint ?? extensionHint,
            handoverStatus: mapHandoverStatus(
              String(handoverHint ?? ""),
              String(extensionHint ?? ""),
              finishingRaw
            ),
            actionLabel:
              String(colByHeader(row, deliveryCols, "action taken") ?? "").trim() ||
              undefined,
            notes:
              String(colByHeader(row, deliveryCols, "note", "note") ?? "").trim() ||
              undefined,
            cases: buildMasterSheetCases({
              engineeringRaw: colByHeader(
                row,
                deliveryCols,
                "current situation (eng)"
              ),
              actionRaw: colByHeader(row, deliveryCols, "action taken"),
              customerServiceRaw: colByHeader(row, deliveryCols, "خدمة العملاء"),
              legalRaw: colByHeader(row, deliveryCols, "الموقف القانوني"),
              warningsRaw: colByHeader(row, deliveryCols, "اخطار استلام"),
              handoverRaw: handoverHint ?? extensionHint,
            }),
          });
        } catch (error) {
          result.errors.push({
            row: i + 1,
            sheet: deliveryDataName,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
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

        const gateContext = await loadImportGateContext(unit.id);
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
          ticketCounters,
          gateContext
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

  if (runAssignmentSync) {
    const assignmentSync = await syncAssignmentsFromWorkbook(buffer);
    result.unitsAssigned = assignmentSync.unitsAssigned;
    result.ticketsAssigned = assignmentSync.ticketsAssigned;
    result.agentsUnresolved = assignmentSync.agentsUnresolved;
    result.unmatchedAgentNames = assignmentSync.unmatchedAgentNames;
  }

  return result;
}

/** Import multiple workbooks in order (later files upsert / enrich earlier rows). */
export async function ingestWorkbooks(buffers: Buffer[]): Promise<ImportResult> {
  if (buffers.length === 0) return emptyImportResult();

  let merged = await ingestWorkbook(buffers[0]!, {
    runAssignmentSync: buffers.length === 1,
  });

  for (let i = 1; i < buffers.length; i++) {
    merged = mergeImportResults(
      merged,
      await ingestWorkbook(buffers[i]!, { runAssignmentSync: false })
    );
  }

  if (buffers.length > 1) {
    const assignmentSync = await syncAssignmentsFromWorkbook(buffers[0]!);
    merged.unitsAssigned = assignmentSync.unitsAssigned;
    merged.ticketsAssigned = assignmentSync.ticketsAssigned;
    merged.agentsUnresolved = assignmentSync.agentsUnresolved;
    merged.unmatchedAgentNames = assignmentSync.unmatchedAgentNames;
  }

  return merged;
}
