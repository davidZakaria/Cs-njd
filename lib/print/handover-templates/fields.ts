import type { HandoverFieldValues } from "./types";

type UnitLike = {
  unitCode: string;
  area: number | null;
  client: {
    name: string;
    nationalId: string | null;
    phone1: string | null;
    phone2: string | null;
    email: string | null;
    address1: string | null;
    address2: string | null;
  } | null;
  contractWorkflow: {
    contractDate: Date | null;
    deliveryDate: Date | null;
  } | null;
};

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

export function buildHandoverFields(
  unit: UnitLike,
  locale: string,
  issuedAt: Date = new Date()
): HandoverFieldValues {
  const contractDate = unit.contractWorkflow?.contractDate ?? null;
  const deliveryDate = unit.contractWorkflow?.deliveryDate ?? issuedAt;
  const area = unit.area != null ? String(unit.area) : "—";
  const { floor, building, unitNumber } = parseUnitCode(unit.unitCode);

  return {
    clientName: unit.client?.name ?? "—",
    nationality: locale === "ar" ? "مصري" : "Egyptian",
    nationalId: unit.client?.nationalId ?? "—",
    address: [unit.client?.address1, unit.client?.address2].filter(Boolean).join(" — ") || "—",
    phone1: unit.client?.phone1 ?? "—",
    phone2: unit.client?.phone2 ?? "—",
    email: unit.client?.email ?? "—",
    unitNumber,
    floor,
    building,
    area,
    areaInWords: area,
    handoverDate: formatShortDate(deliveryDate, locale),
    contractDay: contractDate ? String(contractDate.getDate()) : "—",
    contractMonth: contractDate
      ? contractDate.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { month: "long" })
      : "—",
    contractYear: contractDate ? String(contractDate.getFullYear()) : "—",
    issuedDayName:
      locale === "ar"
        ? DAY_NAMES_AR[issuedAt.getDay()]
        : DAY_NAMES_EN[issuedAt.getDay()],
    issuedDate: formatShortDate(issuedAt, locale),
    contractShortDate: contractDate ? formatShortDate(contractDate, locale) : "—",
  };
}

export function interpolateHandoverText(text: string, fields: HandoverFieldValues): string {
  return text
    .replace(/000000000000000/g, fields.nationalId)
    .replace(/\(00\/00\/0000\)/g, fields.handoverDate)
    .replace(/\(00\/00\/\s*م\)/g, fields.contractShortDate)
    .replace(
      /يوم \(00\) من شهر\s*\(00\) سنة \(0000\)/g,
      `يوم (${fields.contractDay}) من شهر (${fields.contractMonth}) سنة (${fields.contractYear})`
    )
    .replace(
      /يوم \(00\) من شهر \(00\) سنة \(0000\)/g,
      `يوم (${fields.contractDay}) من شهر (${fields.contractMonth}) سنة (${fields.contractYear})`
    )
    .replace(/\(الاحد\)/g, `(${fields.issuedDayName})`)
    .replace(/\(17\/ 05\/2026م\)/g, `(${fields.issuedDate})`)
    .replace(/رقم \(\)/g, `رقم (${fields.unitNumber})`)
    .replace(/بالطابق \(\)/g, `بالطابق (${fields.floor})`)
    .replace(/عماره \(\)/g, `عماره (${fields.building})`)
    .replace(/بالدور\(\)/g, `بالدور (${fields.floor})`)
    .replace(/مساحتها \(\)/g, `مساحتها (${fields.area})`)
    .replace(/الاسم :\s+/g, `الاسم : ${fields.clientName} `)
    .replace(/1-الاسم :\s+/g, `1-الاسم : ${fields.clientName} `)
    .replace(/2-الاسم :\s+/g, `2-الاسم : ${fields.clientName2 ?? "—"} `);
}

export function splitViolationItems(body: string): string[] {
  const [main, closing] = body.split("كل ما ورد من انواع المخالفات");
  const intro = main.match(/^بمجرد[^:]*:/)?.[0] ?? "";
  const itemsText = main.slice(intro.length).trim();
  const items = itemsText
    .split(/(?=عدم |وفي حالة|و في جميع|السماح|لا يسمح|يكون |في حاله|عمل )/)
    .map((s) => s.trim())
    .filter(Boolean);
  const tail = closing ? `كل ما ورد من انواع المخالفات${closing}`.trim() : "";
  return [...(intro ? [intro.trim()] : []), ...items, ...(tail ? [tail] : [])];
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
  return date.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatGreenAvenueHeader(header: string) {
  return {
    title: "محضر تسليم وحدة السكنية",
    project: "بمشروع جرين افينيو",
    location: header.includes("العاصمة") ? "العاصمة الادارية الجديدة" : "",
  };
}
