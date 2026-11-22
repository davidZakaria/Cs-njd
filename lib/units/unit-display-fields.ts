import type { FinishingType } from "@prisma/client";

import { formatDate } from "@/lib/format/datetime";

export type UnitDisplayWorkflowSlice = {
  contractDate: Date | null;
  deliveryDate: Date | null;
  finalSaleContractDate?: Date | null;
  signedProtocolDate?: Date | null;
  deletedAt?: Date | null;
} | null;

export type UnitDisplayFinishingSlice = {
  finishingType: FinishingType | null;
  contractDate?: Date | null;
} | null;

export type SaleContractDateSource =
  | "contractWorkflow.contractDate"
  | "contractWorkflow.finalSaleContractDate"
  | "contractWorkflow.signedProtocolDate";

export type ResolvedUnitDisplayFields = {
  deliveryDate: Date | null;
  saleContractDate: Date | null;
  saleContractDateSource: SaleContractDateSource | null;
  finishingType: FinishingType | null;
  /** Finishing-company contract date (financials); not the preliminary sale contract. */
  finishingContractDate: Date | null;
};

export type UnitDisplayFieldsInput = {
  contractWorkflow?: UnitDisplayWorkflowSlice;
  finishing?: UnitDisplayFinishingSlice;
};

function activeWorkflow(
  workflow: UnitDisplayWorkflowSlice | undefined
): Exclude<UnitDisplayWorkflowSlice, null> | null {
  if (!workflow || workflow.deletedAt != null) return null;
  return workflow;
}

/**
 * Canonical UI resolution for delivery date, sale contract date, and finishing type.
 *
 * Sale contract date (CS summary / legal): `ContractWorkflow.contractDate` first,
 * then `finalSaleContractDate`, then `signedProtocolDate`. Finishing.contractDate is
 * never used for sale contract display (it is the finishing-company contract).
 */
export function resolveUnitDisplayFields(
  input: UnitDisplayFieldsInput
): ResolvedUnitDisplayFields {
  const workflow = activeWorkflow(input.contractWorkflow ?? null);
  const finishing = input.finishing ?? null;

  const deliveryDate = workflow?.deliveryDate ?? null;

  let saleContractDate: Date | null = null;
  let saleContractDateSource: SaleContractDateSource | null = null;
  if (workflow?.contractDate) {
    saleContractDate = workflow.contractDate;
    saleContractDateSource = "contractWorkflow.contractDate";
  } else if (workflow?.finalSaleContractDate) {
    saleContractDate = workflow.finalSaleContractDate;
    saleContractDateSource = "contractWorkflow.finalSaleContractDate";
  } else if (workflow?.signedProtocolDate) {
    saleContractDate = workflow.signedProtocolDate;
    saleContractDateSource = "contractWorkflow.signedProtocolDate";
  }

  const finishingType = finishing?.finishingType ?? null;

  return {
    deliveryDate,
    saleContractDate,
    saleContractDateSource,
    finishingType,
    finishingContractDate: finishing?.contractDate ?? null,
  };
}

export function toUnitDisplayIso(date: Date | null | undefined): string | null {
  if (!date) return null;
  const time = date.getTime();
  if (Number.isNaN(time)) return null;
  return date.toISOString();
}

export type SerializableUnitDisplayFields = {
  deliveryDate: string | null;
  saleContractDate: string | null;
  saleContractDateSource: SaleContractDateSource | null;
  finishingType: string | null;
  finishingContractDate: string | null;
};

export function serializeUnitDisplayFields(
  fields: ResolvedUnitDisplayFields
): SerializableUnitDisplayFields {
  return {
    deliveryDate: toUnitDisplayIso(fields.deliveryDate),
    saleContractDate: toUnitDisplayIso(fields.saleContractDate),
    saleContractDateSource: fields.saleContractDateSource,
    finishingType: fields.finishingType,
    finishingContractDate: toUnitDisplayIso(fields.finishingContractDate),
  };
}

export function formatUnitDisplayDate(
  value: Date | string | null | undefined,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string | null {
  if (value == null || value === "") return null;
  try {
    return formatDate(value, locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
    });
  } catch {
    return null;
  }
}