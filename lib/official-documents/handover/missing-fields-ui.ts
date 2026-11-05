import {
  OFFICIAL_HANDOVER_MISSING_PATTERN,
} from "./constants";

export function listMissingFieldsInBody(body: string): string[] {
  const keys = new Set<string>();
  for (const match of body.matchAll(OFFICIAL_HANDOVER_MISSING_PATTERN)) {
    keys.add(match[1]!);
  }
  return [...keys];
}

export function officialHandoverMissingFieldLabel(
  key: string,
  locale: string
): string {
  const labelsEn: Record<string, string> = {
    owner1_name: "Primary owner name",
    owner1_national_id: "Primary owner national ID",
    owner1_address: "Primary owner address",
    owner1_phone1: "Primary owner phone",
    owner1_email: "Primary owner email",
    owner2_name: "Co-owner name",
    owner2_national_id: "Co-owner national ID",
    unit_number: "Unit number",
    floor: "Floor",
    building: "Building",
    area_sqm: "Unit area (m²)",
    handover_date: "Handover date",
    contract_day: "Contract day",
    contract_month: "Contract month",
    contract_year: "Contract year",
    contract_date: "Contract date",
  };
  const labelsAr: Record<string, string> = {
    owner1_name: "اسم المالك الأساسي",
    owner1_national_id: "الرقم القومي للمالك الأساسي",
    owner1_address: "عنوان المالك الأساسي",
    owner1_phone1: "هاتف المالك الأساسي",
    owner1_email: "بريد المالك الأساسي",
    owner2_name: "اسم المالك الثاني",
    owner2_national_id: "الرقم القومي للمالك الثاني",
    unit_number: "رقم الوحدة",
    floor: "الطابق",
    building: "العمارة",
    area_sqm: "مساحة الوحدة",
    handover_date: "تاريخ التسليم",
    contract_day: "يوم العقد",
    contract_month: "شهر العقد",
    contract_year: "سنة العقد",
    contract_date: "تاريخ العقد",
  };
  const table = locale === "ar" ? labelsAr : labelsEn;
  return table[key] ?? key;
}
