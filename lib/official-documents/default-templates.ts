import type { OfficialDocumentType } from "@prisma/client";

type TemplateSeed = {
  documentType: OfficialDocumentType;
  locale: string;
  title: string;
  body: string;
};

const sharedFieldsEn = `
Project: {{projectName}}
Unit code: {{unitCode}} (No. {{unitNumber}}, floor {{floor}}, building {{building}})
Area (m²): {{area}}

Primary owner: {{primaryOwnerName}}
National ID: {{primaryOwnerNationalId}}
Phone: {{primaryOwnerPhone}}
Email: {{primaryOwnerEmail}}
Address: {{primaryOwnerAddress}}
Co-owners: {{coOwnersList}}

Contract date: {{contractDate}}
Delivery date: {{deliveryDate}}
Grace period: {{gracePeriod}}
Contract price per m²: {{contractPricePerMeter}}

Finishing type: {{finishingType}}
Finishing package: {{finishingPackage}}
Total finishing price: {{finishingTotalPrice}}
Finishing price per m²: {{finishingPricePerMeter}}

Issued on {{issuedDayName}}, {{issuedDate}}.
`.trim();

const sharedFieldsAr = `
المشروع: {{projectName}}
كود الوحدة: {{unitCode}} (رقم {{unitNumber}}، الدور {{floor}}، عمارة {{building}})
المساحة (م²): {{area}}

المالك الأساسي: {{primaryOwnerName}}
الرقم القومي: {{primaryOwnerNationalId}}
الهاتف: {{primaryOwnerPhone}}
البريد: {{primaryOwnerEmail}}
العنوان: {{primaryOwnerAddress}}
المالكون المشاركون: {{coOwnersList}}

تاريخ العقد: {{contractDate}}
تاريخ التسليم: {{deliveryDate}}
فترة السماح: {{gracePeriod}}
سعر العقد للمتر: {{contractPricePerMeter}}

نوع التشطيب: {{finishingType}}
باقة التشطيب: {{finishingPackage}}
إجمالي التشطيب: {{finishingTotalPrice}}
سعر التشطيب للمتر: {{finishingPricePerMeter}}

صدر يوم {{issuedDayName}} بتاريخ {{issuedDate}}.
`.trim();

export const DEFAULT_OFFICIAL_DOCUMENT_TEMPLATES: TemplateSeed[] = [
  {
    documentType: "GRACE_PERIOD_ANNEX",
    locale: "en",
    title: "Grace Period Annex (Extension)",
    body: `Grace Period Annex\n\n${sharedFieldsEn}\n\nRequest details: {{requestDescription}}`,
  },
  {
    documentType: "GRACE_PERIOD_ANNEX",
    locale: "ar",
    title: "ملحق المد (Grace Period Annex)",
    body: `ملحق المد\n\n${sharedFieldsAr}\n\nتفاصيل الطلب: {{requestDescription}}`,
  },
  {
    documentType: "CONTRACT_AMENDMENT",
    locale: "en",
    title: "Contract Amendment",
    body: `Contract Amendment\n\n${sharedFieldsEn}\n\nAmendment summary: {{requestDescription}}`,
  },
  {
    documentType: "CONTRACT_AMENDMENT",
    locale: "ar",
    title: "تعديل العقد",
    body: `تعديل العقد\n\n${sharedFieldsAr}\n\nملخص التعديل: {{requestDescription}}`,
  },
  {
    documentType: "HANDOVER_RECORD",
    locale: "en",
    title: "Handover Record",
    body: `Unit Handover Record\n\n${sharedFieldsEn}`,
  },
  {
    documentType: "HANDOVER_RECORD",
    locale: "ar",
    title: "محضر التسليم",
    body: `محضر تسليم الوحدة\n\n${sharedFieldsAr}`,
  },
  {
    documentType: "FINISHING_CONTRACT_SUMMARY",
    locale: "en",
    title: "Finishing Contract Summary",
    body: `Finishing Contract Summary\n\n${sharedFieldsEn}\n\nFinishing contract date: {{finishingContractDate}}\nDoor fees: {{finishingDoorFees}}\nAluminum fees: {{finishingAluminumFees}}`,
  },
  {
    documentType: "FINISHING_CONTRACT_SUMMARY",
    locale: "ar",
    title: "ملخص عقد التشطيب",
    body: `ملخص عقد التشطيب\n\n${sharedFieldsAr}\n\nتاريخ عقد التشطيب: {{finishingContractDate}}\nرسوم الأبواب: {{finishingDoorFees}}\nرسوم الألوميتال: {{finishingAluminumFees}}`,
  },
  {
    documentType: "UNIT_SWAP_ADDENDUM",
    locale: "en",
    title: "Unit Swap Addendum",
    body: `Unit Swap Addendum\n\n${sharedFieldsEn}\n\nOutgoing unit: {{swapOutgoingUnitCode}} ({{swapOutgoingProjectName}})\nIncoming from: {{swappedFromUnitCode}} ({{swappedFromProjectName}})\n\nSwap details: {{requestDescription}}`,
  },
  {
    documentType: "UNIT_SWAP_ADDENDUM",
    locale: "ar",
    title: "ملحق استبدال الوحدة",
    body: `ملحق استبدال الوحدة\n\n${sharedFieldsAr}\n\nالوحدة المستبدلة: {{swapOutgoingUnitCode}} ({{swapOutgoingProjectName}})\nاستبدلت من: {{swappedFromUnitCode}} ({{swappedFromProjectName}})\n\nتفاصيل الاستبدال: {{requestDescription}}`,
  },
];
