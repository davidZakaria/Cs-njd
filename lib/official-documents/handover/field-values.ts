import {
  allClientAddressValues,
  allClientPhoneValues,
  normalizeContactValue,
  type ClientWithContactLines,
} from "@/lib/client/contact-lines";
import type { UnitMergeInput } from "@/lib/official-documents/merge-fields";
import type { HandoverFieldValues } from "@/lib/print/handover-templates/types";

import {
  formatOfficialHandoverMissingToken,
} from "./constants";

const DAY_NAMES_AR = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export type OfficialHandoverFieldKey =
  | "owner1_name"
  | "owner1_nationality"
  | "owner1_national_id"
  | "owner1_address"
  | "owner1_phone1"
  | "owner1_phone2"
  | "owner1_email"
  | "owner2_name"
  | "owner2_national_id"
  | "owner2_address"
  | "owner2_phone1"
  | "owner2_email"
  | "unit_number"
  | "floor"
  | "building"
  | "area_sqm"
  | "area_words"
  | "handover_date"
  | "handover_weekday"
  | "contract_day"
  | "contract_month"
  | "contract_year"
  | "contract_date";

const OPTIONAL_MISSING_KEYS = new Set<OfficialHandoverFieldKey>([
  "owner1_phone2",
  "owner1_email",
  "owner2_phone1",
  "owner2_email",
]);

export type OfficialHandoverFieldBuildResult = {
  values: Record<OfficialHandoverFieldKey, string>;
  missingKeys: OfficialHandoverFieldKey[];
  handoverFields: HandoverFieldValues;
};

function primaryClientAddress(client: ClientWithContactLines): string | null {
  const primary = normalizeContactValue(client.address1);
  if (primary) return primary;

  const seen = new Set<string>();
  for (const value of allClientAddressValues(client)) {
    const normalized = normalizeContactValue(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    return normalized;
  }
  return null;
}

function formatWesternShortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function parseUnitCode(unitCode: string) {
  const parts = unitCode.split(/[-_/\\s]+/).filter(Boolean);
  return {
    unitNumber: parts[0] ?? unitCode,
    floor: parts[1] ?? "",
    building: parts[2] ?? "",
  };
}

function isMissingValue(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === "—" || trimmed === "-";
}

function resolvePrimaryAndCoOwners(unit: UnitMergeInput) {
  const primary =
    unit.unitClients.find((l) => l.role === "PRIMARY")?.client ?? unit.client;
  const coOwners = unit.unitClients
    .filter((l) => l.role === "CO_OWNER")
    .map((l) => l.client);
  return { primary, coOwner: coOwners[0] ?? null };
}

export function buildOfficialHandoverFieldValues(
  unit: UnitMergeInput,
  locale: string,
  issuedAt: Date = new Date()
): OfficialHandoverFieldBuildResult {
  const { primary, coOwner } = resolvePrimaryAndCoOwners(unit);
  const { floor, building, unitNumber } = parseUnitCode(unit.unitCode);
  const contractDate = unit.contractWorkflow?.contractDate ?? null;
  const handoverAt = unit.contractWorkflow?.deliveryDate ?? issuedAt;

  const raw: Record<OfficialHandoverFieldKey, string | null> = {
    owner1_name: primary?.name ?? null,
    owner1_nationality: locale === "ar" ? "مصري" : "Egyptian",
    owner1_national_id: primary?.nationalId ?? null,
    owner1_address: primary ? primaryClientAddress(primary) : null,
    owner1_phone1: primary ? allClientPhoneValues(primary)[0] ?? null : null,
    owner1_phone2: primary ? allClientPhoneValues(primary)[1] ?? null : null,
    owner1_email: primary?.email ?? null,
    owner2_name: coOwner?.name ?? null,
    owner2_national_id: coOwner?.nationalId ?? null,
    owner2_address: coOwner ? primaryClientAddress(coOwner) : null,
    owner2_phone1: coOwner ? allClientPhoneValues(coOwner)[0] ?? null : null,
    owner2_email: coOwner?.email ?? null,
    unit_number: unitNumber,
    floor,
    building,
    area_sqm: unit.area != null ? String(unit.area) : null,
    area_words: unit.area != null ? String(unit.area) : null,
    handover_date: formatWesternShortDate(handoverAt),
    handover_weekday: DAY_NAMES_AR[handoverAt.getDay()],
    contract_day: contractDate ? String(contractDate.getDate()) : null,
    contract_month: contractDate
      ? contractDate.toLocaleDateString("ar-EG", {
          month: "long",
          numberingSystem: "latn",
        })
      : null,
    contract_year: contractDate ? String(contractDate.getFullYear()) : null,
    contract_date: contractDate ? formatWesternShortDate(contractDate) : null,
  };

  const missingKeys: OfficialHandoverFieldKey[] = [];
  const values = {} as Record<OfficialHandoverFieldKey, string>;

  for (const key of Object.keys(raw) as OfficialHandoverFieldKey[]) {
    const value = raw[key];
    if (isMissingValue(value)) {
      if (key.startsWith("owner2_") && !coOwner) continue;
      if (OPTIONAL_MISSING_KEYS.has(key)) {
        values[key] = value?.trim() ? value : "—";
        continue;
      }
      missingKeys.push(key);
      values[key] = formatOfficialHandoverMissingToken(key);
    } else {
      values[key] = value!;
    }
  }

  const handoverFields: HandoverFieldValues = {
    clientName: values.owner1_name,
    clientName2: coOwner ? values.owner2_name : undefined,
    nationality: values.owner1_nationality,
    nationalId: values.owner1_national_id,
    nationalId2: coOwner ? values.owner2_national_id : undefined,
    address: values.owner1_address,
    phone1: values.owner1_phone1,
    phone2: values.owner1_phone2 ?? formatOfficialHandoverMissingToken("owner1_phone2"),
    email: values.owner1_email,
    unitNumber: values.unit_number,
    floor: values.floor,
    building: values.building,
    area: values.area_sqm,
    areaInWords: values.area_words,
    handoverDate: values.handover_date,
    contractDay: values.contract_day,
    contractMonth: values.contract_month,
    contractYear: values.contract_year,
    issuedDayName: values.handover_weekday,
    issuedDate: values.handover_date,
    contractShortDate: values.contract_date,
  };

  return { values, missingKeys, handoverFields };
}
