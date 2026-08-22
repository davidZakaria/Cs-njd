import type {
  ExecutingCompany,
  FinishingPackage,
  FinishingType,
  HandoverStatus,
  UnitType,
} from "@prisma/client";

import {
  fuzzyMatchEnum,
  type FuzzyCandidate,
} from "@/lib/import/fuzzy-match";

const FINISHING_PACKAGE_CANDIDATES: FuzzyCandidate<FinishingPackage>[] = [
  {
    value: "LESS_THAN_COMPANY",
    patterns: [
      "أقل من باقة الشركة",
      "اقل من باقة الشركة",
      "اقل من باقه الشركة",
      "less than company",
    ],
  },
  {
    value: "COMPANY_PACKAGE",
    patterns: ["باقة الشركة", "باقه الشركة", "company package"],
  },
  {
    value: "PACKAGE_1",
    patterns: [
      "باقة أولي",
      "باقة اولي",
      "باقة 1",
      "باقه 1",
      "package 1",
      "الباقة الأولى",
      "الاولى",
    ],
  },
  {
    value: "PACKAGE_2",
    patterns: [
      "باقة ثانية",
      "باقة 2",
      "باقه 2",
      "package 2",
      "الباقة الثانية",
      "الثانية",
    ],
  },
  {
    value: "PACKAGE_3",
    patterns: [
      "باقة ثالثة",
      "باقة 3",
      "باقه 3",
      "package 3",
      "الباقة الثالثة",
      "الثالثة",
    ],
  },
  {
    value: "PACKAGE_4",
    patterns: [
      "باقة رابعة",
      "باقة 4",
      "باقه 4",
      "package 4",
      "الباقة الرابعة",
      "الرابعة",
    ],
  },
  {
    value: "THREE_QUARTERS",
    patterns: ["3/4 تشطيب", "3/4", "three quarter", "ثلاث ارباع", "ثلاثة أرباع"],
  },
  {
    value: "FURNITURE",
    patterns: ["فرش", "furnished", "furniture"],
  },
  {
    value: "FURNITURE_AND_AC",
    patterns: [
      "فرش وأجهزه",
      "فرش واجهزه",
      "فرش وأجهزة",
      "فرش وتكييف",
      "furniture and ac",
    ],
  },
  {
    value: "FINISHING",
    patterns: ["تشطيب", "finishing"],
  },
  {
    value: "COMPANY_FINISHING",
    patterns: [
      "تشطيب شركه",
      "تشطيب شركة",
      "company finishing",
      "تشطيب الشركة",
    ],
  },
  {
    value: "CORE_AND_SHELL",
    patterns: ["على العظم", "core and shell", "core", "shell"],
  },
  {
    value: "CUSTOM",
    patterns: ["custom", "تشطيب خاص"],
  },
];

const EXECUTING_COMPANY_CANDIDATES: FuzzyCandidate<ExecutingCompany>[] = [
  {
    value: "NJD",
    patterns: ["تشطيب شركة njd", "njd", "شركة njd"],
  },
  {
    value: "GERGES_YOUSSEF",
    patterns: [
      "شركة م/ جرجس يوسف للإنشاءات",
      "شركة جرجس يوسف للإنشاءات",
      "جرجس يوسف",
      "gerges youssef",
      "م/ جرجس",
    ],
  },
  {
    value: "OTHER",
    patterns: ["other", "أخرى", "اخرى"],
  },
];

const HANDOVER_STATUS_CANDIDATES: FuzzyCandidate<HandoverStatus>[] = [
  {
    value: "CANCELLED",
    patterns: ["فسخ", "cancelled", "canceled", "تم فسخ"],
  },
  {
    value: "DELIVERY_PROTOCOL",
    patterns: ["محضر استلام", "محضر", "delivered", "تم الاستلام"],
  },
  {
    value: "DELIVERY_EXTENSION",
    patterns: [
      "ملحق بمد الاستلام",
      "ملحق مد الاستلام",
      "ملحق",
      "مد الاستلام",
      "extension",
    ],
  },
  {
    value: "FINISHING_CHANGE",
    patterns: [
      "تغير نوع التشطيب",
      "تغيير نوع التشطيب",
      "تغير التشطيب",
      "finishing change",
    ],
  },
  {
    value: "UNIT_SWAP",
    patterns: [
      "تبديل وحده بأخري",
      "تبديل وحدة بأخرى",
      "تبديل وحده",
      "unit swap",
    ],
  },
  {
    value: "NEW_CONTRACT",
    patterns: ["عقد جديد", "new contract", "تم عمل عقد"],
  },
  {
    value: "WAIVER",
    patterns: ["تنازل", "waiver", "تم التنازل"],
  },
  {
    value: "REFUSED_DELIVERY",
    patterns: ["رافض الاستلام", "رفض الاستلام", "refused delivery"],
  },
  {
    value: "REFUSED_EXTENSION",
    patterns: ["رافض المد", "رفض المد", "refused extension"],
  },
  {
    value: "INSTALLMENT_STOP_WARNING",
    patterns: [
      "أخطار وقف أقساط",
      "اخطار وقف اقساط",
      "وقف أقساط",
      "installment stop warning",
    ],
  },
  {
    value: "DELIVERY_WARNING",
    patterns: [
      "أخطار بالأستلام",
      "اخطار بالاستلام",
      "إخطار بالاستلام",
      "delivery warning",
    ],
  },
  {
    value: "PENDING",
    patterns: ["pending", "معلق", "لم يسلم"],
  },
];

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
  const text = values.filter(Boolean).join(" ");
  const matched = fuzzyMatchEnum(text, HANDOVER_STATUS_CANDIDATES, 0.55);
  if (matched) return matched;

  const lower = text.toLowerCase();
  if (lower.includes("delivered") || lower.includes("استلام")) return "DELIVERY_PROTOCOL";
  if (lower.includes("extension") || lower.includes("ملحق")) return "DELIVERY_EXTENSION";
  if (lower.includes("legal") || lower.includes("قانوني") || lower.includes("رافض")) {
    return "REFUSED_DELIVERY";
  }
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
  if (!(raw ?? "").trim()) return null;
  return fuzzyMatchEnum(raw, FINISHING_PACKAGE_CANDIDATES, 0.58);
}

export function mapExecutingCompany(raw?: string): ExecutingCompany | null {
  if (!(raw ?? "").trim()) return null;
  return fuzzyMatchEnum(raw, EXECUTING_COMPANY_CANDIDATES, 0.58);
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
