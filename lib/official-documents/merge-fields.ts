import {
  allClientAddressValues,
  allClientPhoneValues,
  type ClientWithContactLines,
} from "@/lib/client/contact-lines";
import type { MergeFieldValues } from "@/lib/official-documents/types";
import { formatShortDateForOfficialPdf } from "@/lib/official-documents/pdf-text-layout";

const DAY_NAMES_AR = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const DAY_NAMES_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type UnitMergeInput = {
  unitCode: string;
  area: number | null;
  gracePeriod: string | null;
  contractPricePerMeter: number | null;
  swapOutgoingUnitCode: string | null;
  swapOutgoingProjectName: string | null;
  swappedFromUnitCode: string | null;
  swappedFromProjectName: string | null;
  project: { name: string };
  client: (ClientWithContactLines & {
    name: string;
    nationalId: string | null;
    email: string | null;
  }) | null;
  unitClients: {
    role: string;
    client: ClientWithContactLines & {
      name: string;
      nationalId: string | null;
      email: string | null;
    };
  }[];
  contractWorkflow: {
    contractDate: Date | null;
    deliveryDate: Date | null;
  } | null;
  finishing: {
    finishingType: string;
    packageType: string | null;
    packageLabel: string | null;
    totalFinishingPrice: number | null;
    pricePerMeter: number | null;
    doorFees: number | null;
    aluminumFees: number | null;
    contractDate: Date | null;
  } | null;
};

export function buildOfficialDocumentMergeFields(
  unit: UnitMergeInput,
  locale: string,
  options?: {
    requestDescription?: string | null;
    issuedAt?: Date;
  }
): MergeFieldValues {
  const issuedAt = options?.issuedAt ?? new Date();
  const { floor, building, unitNumber } = parseUnitCode(unit.unitCode);
  const primary =
    unit.unitClients.find((l) => l.role === "PRIMARY")?.client ?? unit.client;
  const coOwners = unit.unitClients
    .filter((l) => l.role === "CO_OWNER")
    .map((l) => l.client);

  const coOwnersList =
    coOwners.length > 0
      ? coOwners
          .map((c) =>
            locale === "ar"
              ? `${c.name} (${c.nationalId ?? "—"})`
              : `${c.name} (${c.nationalId ?? "—"})`
          )
          .join(locale === "ar" ? "؛ " : "; ")
      : locale === "ar"
        ? "—"
        : "—";

  const contractDate = unit.contractWorkflow?.contractDate ?? null;
  const deliveryDate = unit.contractWorkflow?.deliveryDate ?? null;
  const finishing = unit.finishing;

  return {
    projectName: unit.project.name,
    unitCode: unit.unitCode,
    unitNumber,
    floor,
    building,
    area: unit.area != null ? String(unit.area) : "—",
    gracePeriod: unit.gracePeriod ?? "—",
    contractPricePerMeter:
      unit.contractPricePerMeter != null
        ? String(unit.contractPricePerMeter)
        : "—",
    primaryOwnerName: primary?.name ?? "—",
    primaryOwnerNationalId: primary?.nationalId ?? "—",
    primaryOwnerEmail: primary?.email ?? "—",
    primaryOwnerPhone: primary
      ? allClientPhoneValues(primary)[0] ?? "—"
      : "—",
    primaryOwnerAddress: primary
      ? allClientAddressValues(primary).join(" — ") || "—"
      : "—",
    coOwnersList,
    coOwner1Name: coOwners[0]?.name ?? "—",
    coOwner1NationalId: coOwners[0]?.nationalId ?? "—",
    coOwner2Name: coOwners[1]?.name ?? "—",
    coOwner2NationalId: coOwners[1]?.nationalId ?? "—",
    contractDate: contractDate
      ? formatShortDate(contractDate, locale)
      : "—",
    deliveryDate: deliveryDate
      ? formatShortDate(deliveryDate, locale)
      : "—",
    finishingType: finishing?.finishingType ?? "—",
    finishingPackage:
      finishing?.packageLabel ?? finishing?.packageType ?? "—",
    finishingTotalPrice:
      finishing?.totalFinishingPrice != null
        ? String(finishing.totalFinishingPrice)
        : "—",
    finishingPricePerMeter:
      finishing?.pricePerMeter != null
        ? String(finishing.pricePerMeter)
        : "—",
    finishingDoorFees:
      finishing?.doorFees != null ? String(finishing.doorFees) : "—",
    finishingAluminumFees:
      finishing?.aluminumFees != null ? String(finishing.aluminumFees) : "—",
    finishingContractDate: finishing?.contractDate
      ? formatShortDate(finishing.contractDate, locale)
      : "—",
    swapOutgoingUnitCode: unit.swapOutgoingUnitCode ?? "—",
    swapOutgoingProjectName: unit.swapOutgoingProjectName ?? "—",
    swappedFromUnitCode: unit.swappedFromUnitCode ?? "—",
    swappedFromProjectName: unit.swappedFromProjectName ?? "—",
    requestDescription: options?.requestDescription?.trim() || "—",
    issuedDate: formatShortDate(issuedAt, locale),
    issuedDayName:
      locale === "ar"
        ? DAY_NAMES_AR[issuedAt.getDay()]
        : DAY_NAMES_EN[issuedAt.getDay()],
  };
}

export function interpolateOfficialDocumentTemplate(
  body: string,
  fields: MergeFieldValues
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return fields[key] ?? "—";
  });
}

function parseUnitCode(unitCode: string) {
  const parts = unitCode.split(/[-_/\\s]+/).filter(Boolean);
  return {
    unitNumber: parts[0] ?? unitCode,
    floor: parts[1] ?? "—",
    building: parts[2] ?? "—",
  };
}

function formatShortDate(date: Date, locale: string) {
  return formatShortDateForOfficialPdf(date, locale);
}
