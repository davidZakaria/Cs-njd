import type { UnitRequestApproverKind, UnitRequestType } from "@prisma/client";

import type { UnitRequestListRow } from "@/lib/requests/types";

const APPROVER_LABEL_EN: Record<UnitRequestApproverKind, string> = {
  LEGAL: "Legal",
  FINANCE: "Finance",
  MANAGEMENT: "Management",
  CS_AGENT: "CS",
  OPERATIONS: "Operations",
};

const APPROVER_LABEL_AR: Record<UnitRequestApproverKind, string> = {
  LEGAL: "القانونية",
  FINANCE: "المالية",
  MANAGEMENT: "الإدارة",
  CS_AGENT: "خدمة العملاء",
  OPERATIONS: "العمليات",
};

const TYPE_LABEL_EN: Record<UnitRequestType, string> = {
  CONTRACT_ISSUE_OR_AMENDMENT: "contract issue/amendment",
  GRACE_PERIOD_ANNEX: "grace period annex",
  UNIT_SWAP: "unit swap",
  FINISHING_PRICE_CHANGE_OR_DISCOUNT: "finishing price/discount",
  PAYMENT_PLAN_CHANGE: "payment plan change",
  REFUND: "refund",
  SITE_VISIT: "site visit",
  SNAG_OR_DEFECT: "snag or defect",
  HANDOVER_APPOINTMENT: "handover appointment",
  DOCUMENT_CORRECTION: "document correction",
  ARCHIVE_CHECK: "archive check",
  ARCHIVE_FILE_REQUEST: "archive file request",
};

const TYPE_LABEL_AR: Record<UnitRequestType, string> = {
  CONTRACT_ISSUE_OR_AMENDMENT: "مشكلة/تعديل عقد",
  GRACE_PERIOD_ANNEX: "ملحق مد",
  UNIT_SWAP: "تبديل وحدة",
  FINISHING_PRICE_CHANGE_OR_DISCOUNT: "تغيير سعر التشطيب/خصم",
  PAYMENT_PLAN_CHANGE: "تغيير خطة السداد",
  REFUND: "استرداد",
  SITE_VISIT: "زيارة موقع",
  SNAG_OR_DEFECT: "عيب/ملاحظة",
  HANDOVER_APPOINTMENT: "موعد تسليم",
  DOCUMENT_CORRECTION: "تصحيح مستند",
  ARCHIVE_CHECK: "فحص أرشيف",
  ARCHIVE_FILE_REQUEST: "طلب ملف أرشيف",
};

export function requestDaysOverdue(
  dueDate: Date | null,
  now: Date
): number {
  if (!dueDate) return 0;
  return Math.max(
    0,
    Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000)
  );
}

export type LateRequestDigestGroup = {
  department: UnitRequestApproverKind;
  type: UnitRequestType;
  count: number;
  oldestDaysLate: number;
};

export function groupLateRequestsForDigest(
  rows: Pick<UnitRequestListRow, "type" | "currentApproverKind" | "dueDate">[],
  now: Date
): LateRequestDigestGroup[] {
  const map = new Map<string, LateRequestDigestGroup>();

  for (const row of rows) {
    const department = row.currentApproverKind ?? "MANAGEMENT";
    const key = `${department}:${row.type}`;
    const days = requestDaysOverdue(row.dueDate, now);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.oldestDaysLate = Math.max(existing.oldestDaysLate, days);
    } else {
      map.set(key, {
        department,
        type: row.type,
        count: 1,
        oldestDaysLate: days,
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    const dept = a.department.localeCompare(b.department);
    if (dept !== 0) return dept;
    return a.type.localeCompare(b.type);
  });
}

export function formatLateRequestDigestMessage(
  groups: LateRequestDigestGroup[]
): {
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  oldestDaysLate: number;
} {
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const oldestDaysLate = groups.reduce(
    (max, group) => Math.max(max, group.oldestDaysLate),
    0
  );

  if (total === 0) {
    return {
      titleEn: "Late unit requests",
      titleAr: "طلبات وحدات متأخرة",
      messageEn: "No late requests",
      messageAr: "لا توجد طلبات متأخرة",
      oldestDaysLate: 0,
    };
  }

  const enParts = groups.map(
    (group) =>
      `${group.count} with ${APPROVER_LABEL_EN[group.department]} (${TYPE_LABEL_EN[group.type]})`
  );
  const arParts = groups.map(
    (group) =>
      `${group.count} لدى ${APPROVER_LABEL_AR[group.department]} (${TYPE_LABEL_AR[group.type]})`
  );

  const titleEn = total === 1 ? "1 late request" : `${total} late requests`;
  const titleAr = total === 1 ? "طلب متأخر" : `${total} طلبات متأخرة`;

  const oldestSuffixEn =
    oldestDaysLate > 0 ? `; oldest ${oldestDaysLate} day(s) late` : "";
  const oldestSuffixAr =
    oldestDaysLate > 0 ? `؛ الأقدم متأخر ${oldestDaysLate} يوم` : "";

  return {
    titleEn,
    titleAr,
    messageEn: `${titleEn}: ${enParts.join("; ")}${oldestSuffixEn}`,
    messageAr: `${titleAr}: ${arParts.join("؛ ")}${oldestSuffixAr}`,
    oldestDaysLate,
  };
}