import type {
  GreenAvenueTemplate,
  HandoverFieldValues,
  HandoverPrintPayload,
  JuraTemplate,
} from "@/lib/print/handover-templates/types";
import {
  fillEnglishPlaceholders,
  getGreenAvenueEnglish,
  getJuraEnglish,
} from "@/lib/print/handover-templates/en-content";
import {
  formatGreenAvenueHeader,
  interpolateHandoverText,
  splitViolationItems,
} from "@/lib/print/handover-templates/fields";
import { HandoverProtocolHeader } from "@/components/print/handover-brand-logo";

function fieldRow(labelAr: string, labelEn: string, value: string) {
  return { labelAr, labelEn, value };
}

function RecipientBlock({
  fields,
  dual,
  labelsAr,
  labelsEn,
}: {
  fields: HandoverFieldValues;
  dual: boolean;
  labelsAr: Record<string, string>;
  labelsEn: Record<string, string>;
}) {
  const rows = (prefix: string) => [
    fieldRow(`${prefix}${labelsAr.name}`, `${prefix}${labelsEn.name}`, fields.clientName),
    fieldRow(labelsAr.nationality, labelsEn.nationality, fields.nationality),
    fieldRow(labelsAr.nationalId, labelsEn.nationalId, fields.nationalId),
    fieldRow(labelsAr.address, labelsEn.address, fields.address),
    fieldRow(labelsAr.phone1, labelsEn.phone1, fields.phone1),
    fieldRow(labelsAr.phone2, labelsEn.phone2, fields.phone2),
    fieldRow(labelsAr.email, labelsEn.email, fields.email),
  ];

  return (
    <div className="space-y-3">
      {!dual ? (
        <FieldGrid rows={rows("")} />
      ) : (
        <>
          <FieldGrid rows={rows("1- ")} />
          <FieldGrid rows={rows("2- ")} />
        </>
      )}
    </div>
  );
}

function FieldGrid({ rows }: { rows: { labelAr: string; labelEn: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 border border-black/10 bg-black/[0.015] p-2.5 text-[8pt]">
      {rows.map((row) => (
        <div key={row.labelEn} className="grid grid-cols-[1fr_1fr_minmax(0,1.2fr)] gap-2 border-b border-black/5 pb-1 last:border-0">
          <span className="font-semibold text-black/80">{row.labelAr}</span>
          <span className="text-black/55">{row.labelEn}</span>
          <span className="border-b border-dotted border-black/35 font-medium">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function BilingualParagraph({ ar, en }: { ar: string; en: string }) {
  return (
    <div className="handover-bilingual-row grid grid-cols-2 gap-3 border-b border-black/5 py-2 text-[7.25pt] leading-[1.45]">
      <p dir="rtl" className="text-justify font-[family-name:var(--font-cairo)]">
        {ar}
      </p>
      <p dir="ltr" className="text-justify font-[family-name:var(--font-jakarta)] text-black/85">
        {en}
      </p>
    </div>
  );
}

function GreenAvenueDocument({
  template,
  fields,
  companyAddress,
}: {
  template: GreenAvenueTemplate;
  fields: HandoverFieldValues;
  companyAddress: string;
}) {
  const header = formatGreenAvenueHeader(template.header);
  const en = getGreenAvenueEnglish(template.withInsurance, template.dual);
  const enFields = fields as Record<string, string>;
  const declaration = interpolateHandoverText(template.declaration, fields);
  const violations = splitViolationItems(interpolateHandoverText(template.violationsBody, fields));
  const insurance = template.insurance
    ? interpolateHandoverText(template.insurance, fields)
    : null;

  const labelsAr = {
    name: "الاسم",
    nationality: "الجنسية",
    nationalId: "بطاقة الرقم القومى",
    address: "المقيم في",
    phone1: "تليفون 1",
    phone2: "تليفون 2",
    email: "البريد الالكتروني",
  };

  return (
    <>
      <HandoverProtocolHeader accentClass="border-[#1a3a2f]">
        <h1 className="text-[13pt] font-bold text-[#1a3a2f]">{header.title}</h1>
        <p className="mt-0.5 text-[10pt] font-semibold">{header.project}</p>
        <p className="text-[9pt] text-black/70">{header.location}</p>
        <div className="mt-2 border-t border-black/10 pt-2">
          <h2 className="text-[11pt] font-bold text-[#1a3a2f]/90">{en.headerTitle}</h2>
          <p className="text-[8.5pt] text-black/65">{en.headerSubtitle}</p>
        </div>
      </HandoverProtocolHeader>

      <section className="mb-3">
        <SectionHeading ar="أولاً: بيانات المستلم" en={en.section1Title} />
        <RecipientBlock
          fields={fields}
          dual={template.dual}
          labelsAr={labelsAr}
          labelsEn={en.recipientLabels}
        />
      </section>

      <section className="mb-3">
        <SectionHeading ar="ثانياً: بيانات الوحدة" en={en.section2Title} />
        <BilingualParagraph
          ar={interpolateHandoverText(template.section2, fields)}
          en={fillEnglishPlaceholders(en.unitLine, enFields)}
        />
      </section>

      <section className="mb-3">
        <SectionHeading ar="إقرار" en={en.declarationTitle} />
        <BilingualParagraph ar={declaration} en={fillEnglishPlaceholders(en.declaration, enFields)} />
      </section>

      <section className="mb-3">
        <SectionHeading ar={template.violationsIntro} en={en.violationsIntro} />
        <BilingualParagraph ar={violations.join(" ")} en={en.violationsBody} />
        {insurance ? (
          <BilingualParagraph ar={insurance} en={en.insurance ?? ""} />
        ) : null}
      </section>

      <SignatureFooter
        dual={template.dual}
        labelsAr={{
          client: template.dual ? "توقيع المشتري الأول" : "توقيع المشتري",
          client2: template.dual ? "توقيع المشتري الثاني" : undefined,
          company: "توقيع الشركة",
          date: "التاريخ",
        }}
        labelsEn={en.signatures}
        companyAddress={companyAddress}
      />
    </>
  );
}

function JuraDocument({
  template,
  fields,
  companyAddress,
}: {
  template: JuraTemplate;
  fields: HandoverFieldValues;
  companyAddress: string;
}) {
  const en = getJuraEnglish(template.dual);
  const enFields = fields as Record<string, string>;
  const headerAr = interpolateHandoverText(template.header, fields);

  const labelsAr = {
    name: "الاسم",
    nationality: "الجنسية",
    nationalId: "بطاقة / جواز",
    address: "المقيم في",
    phone1: "رقم التليفون",
    phone2: "تليفون 2",
    email: "البريد الالكتروني",
  };

  return (
    <>
      <HandoverProtocolHeader accentClass="border-[#0d4a6b]">
        <h1 className="text-[13pt] font-bold text-[#0d4a6b]">محضر استلام وحدة سياحية</h1>
        <p className="mt-0.5 text-[10pt] font-semibold">بمشروع قرية (جورا)</p>
        <p className="text-[9pt] text-black/70">بمنطقة (الجلالة – العين السخنة)</p>
        <p className="mt-1 text-[8pt] text-black/65">{headerAr.split("إنه").slice(1).join("إنه").trim()}</p>
        <div className="mt-2 border-t border-black/10 pt-2">
          <h2 className="text-[11pt] font-bold text-[#0d4a6b]/90">{en.headerTitle}</h2>
          <p className="text-[8.5pt] text-black/65">{en.headerSubtitle}</p>
          <p className="text-[8pt] text-black/55">
            {fillEnglishPlaceholders(en.headerDateLine, enFields)}
          </p>
        </div>
      </HandoverProtocolHeader>

      <section className="mb-3">
        <RecipientBlock
          fields={fields}
          dual={template.dual}
          labelsAr={labelsAr}
          labelsEn={en.recipientLabels}
        />
      </section>

      {template.parts.map((part, index) => {
        const enPart = en.parts[index];
        if (!enPart) return null;
        const titleAr = part.text.split(/(?<=:)/)[0] ?? part.key;
        return (
          <section key={part.key} className="mb-2">
            <SectionHeading ar={titleAr.trim()} en={enPart.title} />
            <BilingualParagraph
              ar={interpolateHandoverText(part.text, fields)}
              en={fillEnglishPlaceholders(enPart.text, enFields)}
            />
          </section>
        );
      })}

      <SignatureFooter
        dual={template.dual}
        labelsAr={{
          client: template.dual ? "توقيع المالك الأول" : "توقيع المالك",
          client2: template.dual ? "توقيع المالك الثاني" : undefined,
          company: "توقيع الشركة",
          date: "التاريخ",
        }}
        labelsEn={en.signatures}
        companyAddress={companyAddress}
      />
    </>
  );
}

function SectionHeading({ ar, en }: { ar: string; en: string }) {
  return (
    <div className="mb-1.5 grid grid-cols-2 gap-3 border-b border-black/15 pb-1">
      <h3 dir="rtl" className="text-[8.5pt] font-bold text-[#1a3a2f]">
        {ar}
      </h3>
      <h3 dir="ltr" className="text-[8.5pt] font-bold text-[#1a3a2f]/80">
        {en}
      </h3>
    </div>
  );
}

function SignatureFooter({
  dual,
  labelsAr,
  labelsEn,
  companyAddress,
}: {
  dual: boolean;
  labelsAr: { client: string; client2?: string; company: string; date: string };
  labelsEn: { client: string; client2?: string; company: string; date: string };
  companyAddress: string;
}) {
  return (
    <footer
      className={`mt-4 grid gap-4 border-t border-black/15 pt-4 text-[8pt] ${dual ? "grid-cols-3" : "grid-cols-2"}`}
    >
      <SignatureCell labelAr={labelsAr.client} labelEn={labelsEn.client} />
      {dual && labelsAr.client2 ? (
        <SignatureCell labelAr={labelsAr.client2} labelEn={labelsEn.client2 ?? ""} />
      ) : null}
      <SignatureCell
        labelAr={labelsAr.company}
        labelEn={labelsEn.company}
        footer={companyAddress}
      />
    </footer>
  );
}

function SignatureCell({
  labelAr,
  labelEn,
  footer,
}: {
  labelAr: string;
  labelEn: string;
  footer?: string;
}) {
  return (
    <div className="space-y-1">
      <p dir="rtl" className="font-semibold">
        {labelAr}
      </p>
      <p dir="ltr" className="text-black/55">
        {labelEn}
      </p>
      <div className="mt-6 border-b border-black/50" />
      <p className="text-[7pt] text-black/45">{footer}</p>
    </div>
  );
}

export function HandoverProtocolDocument({ data }: { data: HandoverPrintPayload }) {
  return (
    <article className="handover-print-sheet mx-auto w-[210mm] bg-white px-[12mm] py-[10mm] text-black shadow-premium print:m-0 print:w-full print:max-w-none print:px-[10mm] print:py-[8mm] print:shadow-none">
      {data.template.kind === "green-avenue" ? (
        <GreenAvenueDocument
          template={data.template}
          fields={data.fields}
          companyAddress={data.companyAddress}
        />
      ) : (
        <JuraDocument
          template={data.template}
          fields={data.fields}
          companyAddress={data.companyAddress}
        />
      )}
    </article>
  );
}

export type { HandoverPrintPayload, HandoverFieldValues };
