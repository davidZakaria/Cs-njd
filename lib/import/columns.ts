import type {
  ExecutingCompany,
  FinishingPackage,
  FinishingType,
  HandoverStatus,
  UnitType,
} from "@prisma/client";

export function mapUnitType(raw?: string): UnitType {
  const value = (raw ?? "").trim().toLowerCase();
  if (value.includes("duplex")) return "DUPLEX";
  if (value.includes("penthouse")) return "PENTHOUSE";
  if (value.includes("clinic") || value.includes("عياد")) return "CLINIC";
  if (value.includes("admin") || value.includes("اداري")) return "ADMIN";
  if (value.includes("commercial") || value.includes("تجاري") || value.includes("محل")) return "COMMERCIAL";
  if (value.includes("hotel") || value.includes("فندق")) return "HOTEL_APARTMENT";
  return "APARTMENT";
}

export function mapHandoverStatus(...values: (string | undefined)[]): HandoverStatus {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (text.includes("فسخ") || text.includes("cancelled")) return "CANCELLED";
  if (text.includes("قانوني") || text.includes("legal") || text.includes("رافض")) return "LEGAL_DISPUTE";
  if (text.includes("ملحق") || text.includes("extension") || text.includes("مد استلام")) return "EXTENSION";
  if (text.includes("محضر") || text.includes("delivered") || text.includes("استلام")) return "DELIVERED";
  return "PENDING";
}

export function mapFinishingType(raw?: string): FinishingType {
  const value = (raw ?? "").trim().toLowerCase();
  if (value.includes("core")) return "CORE_AND_SHELL";
  if (value.includes("semi")) return "SEMI_FINISHED";
  if (value.includes("air")) return "FULLY_FINISHED_AC";
  if (value.includes("fully")) return "FULLY_FINISHED";
  if (value.includes("3/4") || value.includes("three")) return "THREE_QUARTER";
  if (value.includes("company") || value.includes("باقة")) return "COMPANY_PACKAGE";
  if (value.includes("فرش")) return "FURNISHED";
  if (value.includes("محارة")) return "PLASTER_ONLY";
  if (value.includes("اقل") || value.includes("أقل")) return "BELOW_COMPANY_PACKAGE";
  return "CUSTOM";
}

export function mapFinishingPackage(raw?: string): FinishingPackage | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;

  if (
    value.includes("أقل") ||
    value.includes("اقل") ||
    value.includes("less than")
  ) {
    return "LESS_THAN_COMPANY";
  }
  if (
    /package\s*1|باقة\s*1|باقه\s*1|الاولى|الأولى|الاول|الأول/.test(value)
  ) {
    return "PACKAGE_1";
  }
  if (/package\s*2|باقة\s*2|باقه\s*2|الثانية|الثانيه/.test(value)) {
    return "PACKAGE_2";
  }
  if (/package\s*3|باقة\s*3|باقه\s*3|الثالثة|الثالثه/.test(value)) {
    return "PACKAGE_3";
  }
  if (/package\s*4|باقة\s*4|باقه\s*4|الرابعة|الرابعه/.test(value)) {
    return "PACKAGE_4";
  }
  if (
    value.includes("3/4") ||
    value.includes("three quarter") ||
    value.includes("ثلاث") ||
    value.includes("3-4")
  ) {
    return "THREE_QUARTERS";
  }
  if (
    value.includes("core") ||
    value.includes("shell") ||
    value.includes("عظم")
  ) {
    return "CORE_AND_SHELL";
  }
  if (
    value.includes("باقة الشركة") ||
    value.includes("باقه الشركة") ||
    value.includes("company package")
  ) {
    return "COMPANY_PACKAGE";
  }

  return "CUSTOM";
}

export function mapExecutingCompany(raw?: string): ExecutingCompany | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value.includes("njd")) return "NJD";
  if (
    value.includes("جرجس") ||
    value.includes("gerges") ||
    value.includes("youssef") ||
    value.includes("يوسف")
  ) {
    return "GERGES_YOUSSEF";
  }
  return "OTHER";
}

export function slugifyAgentEmail(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || "agent"}@imported.njd.local`;
}

const BOGUS_AGENT_LABELS = new Set([
  "cancelled",
  "canceled",
  "التجمع",
  "الاستلام في 2028",
  "تبديل وحد في جورا",
  "/",
]);

const CASE_TEXT_MARKERS = [
  "تم فسخ",
  "الوحده",
  "الوحدة",
  "العميل",
  "العميلة",
  "تم التنازل",
  "تم عمل عقد",
  "جاري التفاوض",
  "تمت المعاينة",
  "transfer of ownership",
  "handover in",
];

/** Returns false when a cell value is case/ticket text, not a CS agent name. */
export function isLikelyAgentName(name?: string | null): boolean {
  const value = (name ?? "").trim();
  if (!value || value === "/") return false;
  if (value.length > 45) return false;

  const lower = value.toLowerCase();
  if (BOGUS_AGENT_LABELS.has(lower)) return false;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value)) return false;
  if (CASE_TEXT_MARKERS.some((marker) => lower.includes(marker.toLowerCase()))) {
    return false;
  }

  return true;
}
