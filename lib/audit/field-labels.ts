import type { AuditedModel } from "@/lib/prisma/audited-models";

type FieldLabelMap = Record<string, { en: string; ar: string }>;

const USER_FIELDS: FieldLabelMap = {
  name: { en: "Name", ar: "الاسم" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  role: { en: "Role", ar: "الدور" },
  isActive: { en: "Active", ar: "نشط" },
  is2FAEnabled: { en: "2FA enabled", ar: "المصادقة الثنائية" },
  requiresPasswordChange: {
    en: "Requires password change",
    ar: "يتطلب تغيير كلمة المرور",
  },
  password: { en: "Password", ar: "كلمة المرور" },
  twoFactorSecret: { en: "2FA secret", ar: "سر المصادقة الثنائية" },
  sessionVersion: { en: "Session version", ar: "إصدار الجلسة" },
  deletedAt: { en: "Deleted at", ar: "تاريخ الحذف" },
};

const AUDIT_LOG_FIELDS: FieldLabelMap = {
  rowCount: { en: "Rows exported", ar: "عدد الصفوف المُصدَّرة" },
  filters: { en: "Applied filters", ar: "عوامل التصفية المطبّقة" },
  filter_q: { en: "Search", ar: "بحث" },
  filter_dateFrom: { en: "From date", ar: "من تاريخ" },
  filter_dateTo: { en: "To date", ar: "إلى تاريخ" },
  filter_actorId: { en: "Actor", ar: "الفاعل" },
  filter_tableName: { en: "Entity type", ar: "نوع الكيان" },
  filter_action: { en: "Action", ar: "الإجراء" },
  filter_recordId: { en: "Record ID", ar: "معرّف السجل" },
  filter_page: { en: "Page", ar: "الصفحة" },
  filter_pageSize: { en: "Page size", ar: "حجم الصفحة" },
};

const CLIENT_FIELDS: FieldLabelMap = {
  name: { en: "Client name", ar: "اسم العميل" },
  phone1: { en: "Phone", ar: "الهاتف" },
  phone2: { en: "Phone (legacy)", ar: "هاتف (قديم)" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  nationalId: { en: "National ID", ar: "الرقم القومي" },
  nationalIdFile: { en: "National ID file", ar: "ملف الرقم القومي" },
  address1: { en: "Address", ar: "العنوان" },
  address2: { en: "Address (legacy)", ar: "عنوان (قديم)" },
};

const CLIENT_PHONE_FIELDS: FieldLabelMap = {
  phone: { en: "Phone", ar: "الهاتف" },
  kind: { en: "Kind", ar: "النوع" },
  isPrimary: { en: "Primary", ar: "أساسي" },
  clientId: { en: "Client", ar: "العميل" },
};

const CLIENT_ADDRESS_FIELDS: FieldLabelMap = {
  address: { en: "Address", ar: "العنوان" },
  kind: { en: "Kind", ar: "النوع" },
  isPrimary: { en: "Primary", ar: "أساسي" },
  clientId: { en: "Client", ar: "العميل" },
};

const UNIT_FIELDS: FieldLabelMap = {
  unitNumber: { en: "Unit number", ar: "رقم الوحدة" },
  projectId: { en: "Project", ar: "المشروع" },
  clientId: { en: "Client", ar: "العميل" },
  handoverStatus: { en: "Handover status", ar: "حالة التسليم" },
  unitType: { en: "Unit type", ar: "نوع الوحدة" },
  areaSqm: { en: "Area", ar: "المساحة" },
  assignedAgentId: { en: "Assigned agent", ar: "مسؤول المبيعات" },
  assignedEngineerId: { en: "Assigned engineer", ar: "المهندس" },
};

const TICKET_FIELDS: FieldLabelMap = {
  title: { en: "Title", ar: "العنوان" },
  status: { en: "Status", ar: "الحالة" },
  category: { en: "Category", ar: "التصنيف" },
  unitId: { en: "Unit", ar: "الوحدة" },
  agentId: { en: "Agent", ar: "المسؤول" },
  createdById: { en: "Created by", ar: "أنشئ بواسطة" },
  updatedById: { en: "Updated by", ar: "عُدّل بواسطة" },
  assignedAgentId: { en: "Agent", ar: "المسؤول" },
  description: { en: "Description", ar: "الوصف" },
  notes: { en: "Notes", ar: "ملاحظات" },
  pendingParty: { en: "Pending party", ar: "الجهة المعلّقة" },
};

const FINISHING_FIELDS: FieldLabelMap = {
  unitId: { en: "Unit", ar: "الوحدة" },
  finishingType: { en: "Finishing type", ar: "نوع التشطيب" },
  finishingPackage: { en: "Package", ar: "الباقة" },
  phase: { en: "Phase", ar: "المرحلة" },
};

const CONTRACT_WORKFLOW_FIELDS: FieldLabelMap = {
  unitId: { en: "Unit", ar: "الوحدة" },
  status: { en: "Status", ar: "الحالة" },
};

const MODEL_FIELD_LABELS: Partial<Record<AuditedModel | string, FieldLabelMap>> =
  {
    AuditLog: AUDIT_LOG_FIELDS,
    User: USER_FIELDS,
    Client: CLIENT_FIELDS,
    ClientPhone: CLIENT_PHONE_FIELDS,
    ClientAddress: CLIENT_ADDRESS_FIELDS,
    Unit: UNIT_FIELDS,
    Ticket: TICKET_FIELDS,
    Finishing: FINISHING_FIELDS,
    ContractWorkflow: CONTRACT_WORKFLOW_FIELDS,
  };

export function auditFieldLabel(
  model: string,
  fieldKey: string,
  locale: "en" | "ar"
): string {
  const map = MODEL_FIELD_LABELS[model];
  const entry = map?.[fieldKey];
  if (entry) {
    return entry[locale];
  }
  return fieldKey;
}