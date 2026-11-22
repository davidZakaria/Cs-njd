import type { UnitMergeInput } from "@/lib/official-documents/merge-fields";
import { splitMergedOwnerNames } from "@/lib/utils/arabic-normalize";

type OwnerClient = NonNullable<UnitMergeInput["client"]>;

export type HandoverOwnerResolution =
  | {
      mode: "single";
      primary: OwnerClient | null;
    }
  | {
      mode: "dual";
      source: "co_owner_row" | "merged_name";
      primary: OwnerClient;
      coOwner: OwnerClient | null;
      owner1Name: string;
      owner2Name: string;
    }
  | {
      mode: "blocked";
      reason: "too_many_owners";
      partCount: number;
    };

export function resolveHandoverOwners(unit: UnitMergeInput): HandoverOwnerResolution {
  const primary =
    unit.unitClients.find((link) => link.role === "PRIMARY")?.client ??
    unit.client;
  const coOwnerRows = unit.unitClients
    .filter((link) => link.role === "CO_OWNER")
    .map((link) => link.client);

  if (coOwnerRows.length > 0) {
    if (!primary) {
      return { mode: "single", primary: null };
    }
    const owner1Name = splitMergedOwnerNames(primary.name)[0] ?? primary.name;
    const coOwner = coOwnerRows[0] ?? null;
    return {
      mode: "dual",
      source: "co_owner_row",
      primary,
      coOwner,
      owner1Name,
      owner2Name: coOwner?.name ?? "",
    };
  }

  if (!primary?.name?.trim()) {
    return { mode: "single", primary: primary ?? null };
  }

  const parts = splitMergedOwnerNames(primary.name);
  if (parts.length >= 3) {
    return { mode: "blocked", reason: "too_many_owners", partCount: parts.length };
  }
  if (parts.length === 2) {
    return {
      mode: "dual",
      source: "merged_name",
      primary,
      coOwner: null,
      owner1Name: parts[0]!,
      owner2Name: parts[1]!,
    };
  }

  return { mode: "single", primary };
}

export function handoverDualSignatureApplies(
  resolution: HandoverOwnerResolution
): boolean {
  return resolution.mode === "dual";
}

export function handoverOwnerBlockMessage(
  resolution: HandoverOwnerResolution,
  locale: string
): string | null {
  if (resolution.mode !== "blocked") return null;
  if (locale === "ar") {
    return `لا يمكن إنشاء محضر التسليم — اسم العميل يحتوي على ${resolution.partCount} ملاك. افصلهم إلى سجلات عملاء منفصلة قبل المتابعة.`;
  }
  return `Cannot create handover record — the client name lists ${resolution.partCount} owners. Split them into separate client records before continuing.`;
}

export type HandoverMergedOwnerConvertHints = {
  primaryClientId: string;
  owner1Name: string;
  owner2Name: string;
};

export function getHandoverMergedOwnerConvertHints(
  unit: UnitMergeInput,
  primaryClientId: string | null
): HandoverMergedOwnerConvertHints | null {
  const resolution = resolveHandoverOwners(unit);
  if (resolution.mode !== "dual" || resolution.source !== "merged_name") {
    return null;
  }
  if (!primaryClientId) return null;
  return {
    primaryClientId,
    owner1Name: resolution.owner1Name,
    owner2Name: resolution.owner2Name,
  };
}