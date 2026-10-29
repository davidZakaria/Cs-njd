import { CONTRACT_UNIT_UPDATE_FLAG } from "@/lib/units/contract-unit-update-flags";
import {
  assessFinishingFinancialData,
  isEmptyFinishingFinancialRow,
  type FinishingFinancialInput,
} from "@/lib/finishing/financial-data-quality";

export const OPERATIONS_PROGRESS_ITEM = {
  primaryOwnerId: "primaryOwnerId",
  coOwnerIds: "coOwnerIds",
  preliminaryContract: "preliminaryContract",
  finalContract: "finalContract",
  handoverRecord: "handoverRecord",
  finishingContract: "finishingContract",
  gracePeriodAnnex: "gracePeriodAnnex",
  archiveFiling: "archiveFiling",
  finishingFinancials: "finishingFinancials",
  siteVisit: "siteVisit",
  paperHandoverChecks: "paperHandoverChecks",
} as const;

export type OperationsProgressItemKey =
  (typeof OPERATIONS_PROGRESS_ITEM)[keyof typeof OPERATIONS_PROGRESS_ITEM];

export const OPERATIONS_PROGRESS_ITEM_KEYS: OperationsProgressItemKey[] =
  Object.values(OPERATIONS_PROGRESS_ITEM);

export type OperationsItemStatus =
  | "done"
  | "missing"
  | "needs_update"
  | "not_applicable";

export type OperationsOwnerSnapshot = {
  role: "PRIMARY" | "CO_OWNER";
  nationalIdFile: string | null;
};

export type OperationsProgressInput = {
  gracePeriod: string | null;
  owners: OperationsOwnerSnapshot[];
  workflow: {
    handoverStatus: string;
    hasPreliminarySaleContract: boolean;
    hasFinalSaleContract: boolean;
    hasSignedExtension: boolean;
    hasSignedProtocol: boolean;
    signedContractFile: string | null;
    extensionAnnexFile: string | null;
    signedProtocolStoredName: string | null;
    papersReceived: boolean;
    siteVisitDone: boolean;
    paperHandoverPreliminaryCopy: boolean;
    paperHandoverOriginalProtocol: boolean;
    paperHandoverFinishingPapers: boolean;
    paperHandoverKeyReceived: boolean;
    contractUnitUpdateFlags: string[];
  } | null;
  finishing: {
    packageType: string | null;
    finishingContractFile: string | null;
    finishingContractNeedsUnitUpdate: boolean;
    totalFinishingPrice: number | null;
    doorFees: number | null;
    aluminumFees: number | null;
    pricePerMeter: number | null;
  } | null;
  unitArea: number | null;
};

export type OperationsProgressItem = {
  key: OperationsProgressItemKey;
  status: OperationsItemStatus;
};

export type OperationsProgressSummary = {
  items: OperationsProgressItem[];
  applicableCount: number;
  doneCount: number;
  percentComplete: number;
};

function flagSet(flags: string[]): Set<string> {
  return new Set(flags);
}

function primaryOwner(input: OperationsProgressInput): OperationsOwnerSnapshot | null {
  return input.owners.find((o) => o.role === "PRIMARY") ?? null;
}

function coOwners(input: OperationsProgressInput): OperationsOwnerSnapshot[] {
  return input.owners.filter((o) => o.role === "CO_OWNER");
}

export function isGracePeriodAnnexApplicable(
  input: OperationsProgressInput
): boolean {
  if (input.gracePeriod?.trim()) return true;
  const workflow = input.workflow;
  if (!workflow) return false;
  if (workflow.hasSignedExtension) return true;
  if (workflow.handoverStatus === "DELIVERY_EXTENSION") return true;
  if (workflow.extensionAnnexFile) return true;
  return false;
}

export function isFinishingTrackApplicable(
  input: OperationsProgressInput
): boolean {
  const finishing = input.finishing;
  if (!finishing) return false;
  if (finishing.packageType) return true;
  if (finishing.finishingContractFile) return true;
  return !isEmptyFinishingFinancialRow({
    totalFinishingPrice: finishing.totalFinishingPrice,
    doorFees: finishing.doorFees,
    aluminumFees: finishing.aluminumFees,
    area: input.unitArea,
    pricePerMeter: finishing.pricePerMeter,
  });
}

function finishingFinancialInput(
  input: OperationsProgressInput
): FinishingFinancialInput {
  const finishing = input.finishing;
  return {
    totalFinishingPrice: finishing?.totalFinishingPrice,
    doorFees: finishing?.doorFees,
    aluminumFees: finishing?.aluminumFees,
    area: input.unitArea,
    pricePerMeter: finishing?.pricePerMeter,
  };
}

export function statusPrimaryOwnerId(
  input: OperationsProgressInput
): OperationsItemStatus {
  const owner = primaryOwner(input);
  if (!owner) return "missing";
  return owner.nationalIdFile ? "done" : "missing";
}

export function statusCoOwnerIds(
  input: OperationsProgressInput
): OperationsItemStatus {
  const owners = coOwners(input);
  if (owners.length === 0) return "not_applicable";
  return owners.every((o) => Boolean(o.nationalIdFile)) ? "done" : "missing";
}

export function statusPreliminaryContract(
  input: OperationsProgressInput
): OperationsItemStatus {
  const workflow = input.workflow;
  const flags = flagSet(workflow?.contractUnitUpdateFlags ?? []);
  if (flags.has(CONTRACT_UNIT_UPDATE_FLAG.preliminary)) return "needs_update";
  if (workflow?.signedContractFile) return "done";
  return "missing";
}

export function statusFinalContract(
  input: OperationsProgressInput
): OperationsItemStatus {
  const workflow = input.workflow;
  const flags = flagSet(workflow?.contractUnitUpdateFlags ?? []);
  if (flags.has(CONTRACT_UNIT_UPDATE_FLAG.finalSale)) return "needs_update";
  if (workflow?.hasFinalSaleContract) return "done";
  return "missing";
}

export function statusHandoverRecord(
  input: OperationsProgressInput
): OperationsItemStatus {
  const workflow = input.workflow;
  const flags = flagSet(workflow?.contractUnitUpdateFlags ?? []);
  if (flags.has(CONTRACT_UNIT_UPDATE_FLAG.handoverRecord)) return "needs_update";
  if (workflow?.signedProtocolStoredName) return "done";
  return "missing";
}

export function statusFinishingContract(
  input: OperationsProgressInput
): OperationsItemStatus {
  if (!isFinishingTrackApplicable(input)) return "not_applicable";
  const finishing = input.finishing;
  if (finishing?.finishingContractNeedsUnitUpdate) return "needs_update";
  if (finishing?.finishingContractFile) return "done";
  return "missing";
}

export function statusGracePeriodAnnex(
  input: OperationsProgressInput
): OperationsItemStatus {
  if (!isGracePeriodAnnexApplicable(input)) return "not_applicable";
  const workflow = input.workflow;
  const flags = flagSet(workflow?.contractUnitUpdateFlags ?? []);
  if (flags.has(CONTRACT_UNIT_UPDATE_FLAG.gracePeriodAnnex)) return "needs_update";
  if (workflow?.extensionAnnexFile) return "done";
  return "missing";
}

export function statusArchiveFiling(
  input: OperationsProgressInput
): OperationsItemStatus {
  if (input.workflow?.papersReceived) return "done";
  return "missing";
}

export function statusFinishingFinancials(
  input: OperationsProgressInput
): OperationsItemStatus {
  if (!isFinishingTrackApplicable(input)) return "not_applicable";
  const assessment = assessFinishingFinancialData(finishingFinancialInput(input));
  if (assessment.isEmpty) return "missing";
  if (assessment.financeCheckReasons.length === 0) return "done";
  return "missing";
}

export function statusSiteVisit(
  input: OperationsProgressInput
): OperationsItemStatus {
  if (input.workflow?.siteVisitDone) return "done";
  return "missing";
}

export function statusPaperHandoverChecks(
  input: OperationsProgressInput
): OperationsItemStatus {
  const workflow = input.workflow;
  if (!workflow) return "missing";
  const complete =
    workflow.paperHandoverPreliminaryCopy &&
    workflow.paperHandoverOriginalProtocol &&
    workflow.paperHandoverFinishingPapers &&
    workflow.paperHandoverKeyReceived;
  return complete ? "done" : "missing";
}

const STATUS_BY_KEY: Record<
  OperationsProgressItemKey,
  (input: OperationsProgressInput) => OperationsItemStatus
> = {
  primaryOwnerId: statusPrimaryOwnerId,
  coOwnerIds: statusCoOwnerIds,
  preliminaryContract: statusPreliminaryContract,
  finalContract: statusFinalContract,
  handoverRecord: statusHandoverRecord,
  finishingContract: statusFinishingContract,
  gracePeriodAnnex: statusGracePeriodAnnex,
  archiveFiling: statusArchiveFiling,
  finishingFinancials: statusFinishingFinancials,
  siteVisit: statusSiteVisit,
  paperHandoverChecks: statusPaperHandoverChecks,
};

export function buildOperationsProgressItems(
  input: OperationsProgressInput
): OperationsProgressItem[] {
  return OPERATIONS_PROGRESS_ITEM_KEYS.map((key) => ({
    key,
    status: STATUS_BY_KEY[key](input),
  }));
}

export function summarizeOperationsProgress(
  items: OperationsProgressItem[]
): OperationsProgressSummary {
  const applicable = items.filter((i) => i.status !== "not_applicable");
  const doneCount = applicable.filter((i) => i.status === "done").length;
  const applicableCount = applicable.length;
  const percentComplete =
    applicableCount === 0
      ? 100
      : Math.round((doneCount / applicableCount) * 100);

  return {
    items,
    applicableCount,
    doneCount,
    percentComplete,
  };
}

export function computeOperationsProgress(
  input: OperationsProgressInput
): OperationsProgressSummary {
  return summarizeOperationsProgress(buildOperationsProgressItems(input));
}

export function isOperationsItemIncomplete(
  status: OperationsItemStatus
): boolean {
  return status === "missing" || status === "needs_update";
}

export function unitTabHrefForProgressItem(
  key: OperationsProgressItemKey,
  unitId: string
): string {
  if (
    key === "primaryOwnerId" ||
    key === "coOwnerIds"
  ) {
    return `/units/${unitId}?tab=client`;
  }
  if (key === "finishingContract" || key === "finishingFinancials") {
    return `/units/${unitId}?tab=financials`;
  }
  return `/units/${unitId}?tab=legal`;
}

export * from "@/lib/operations/unit-cycle-progress";
