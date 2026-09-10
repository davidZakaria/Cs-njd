import type {
  GreenAvenueTemplate,
  HandoverFieldValues,
  HandoverPrintPayload,
  JuraTemplate,
} from "@/lib/print/handover-templates/types";
import {
  formatGreenAvenueHeader,
  interpolateHandoverText,
  splitViolationItems,
} from "@/lib/print/handover-templates/fields";
import { HandoverProtocolHeader } from "@/components/print/handover-brand-logo";

type FieldRow = { label: string; value: string };

function RecipientBlock({
  fields,
  dual,
  labels,
}: {
  fields: HandoverFieldValues;
  dual: boolean;
  labels: Record<string, string>;
}) {
  const rows = (prefix: string): FieldRow[] => [
    { label: `${prefix}${labels.name}`, value: fields.clientName },
    { label: labels.nationality, value: fields.nationality },
    { label: labels.nationalId, value: fields.nationalId },
    { label: labels.address, value: fields.address },
    { label: labels.phone1, value: fields.phone1 },
    { label: labels.phone2, value: fields.phone2 },
    { label: labels.email, value: fields.email },
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

function FieldGrid({ rows }: { rows: FieldRow[] }) {
  return (
    <div className="space-y-2 rounded-sm border border-black/15 bg-black/[0.02] p-3 text-[9pt]">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[minmax(5.5rem,7rem)_1fr] items-baseline gap-x-3 gap-y-1"
        >
          <span className="font-semibold text-black/85">{row.label}</span>
          <span className="border-b border-dotted border-black/35 pb-0.5 font-medium">
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function ArabicParagraph({ text }: { text: string }) {
  return (
    <p className="handover-arabic-block text-[9pt] leading-[1.65] text-justify text-black/90">
      {text}
    </p>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h3 className="mb-2 border-b border-black/20 pb-1 text-[10pt] font-bold text-[#1a3a2f]">
      {title}
    </h3>
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
  const declaration = interpolateHandoverText(template.declaration, fields);
  const violations = splitViolationItems(
    interpolateHandoverText(template.violationsBody, fields)
  );
  const insurance = template.insurance
    ? interpolateHandoverText(template.insurance, fields)
    : null;

  const labels = {
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
        <h1 className="text-[14pt] font-bold text-[#1a3a2f]">{header.title}</h1>
        <p className="mt-1 text-[11pt] font-semibold">{header.project}</p>
        <p className="text-[9.5pt] text-black/75">{header.location}</p>
      </HandoverProtocolHeader>

      <section className="mb-4">
        <SectionHeading title="أولاً: بيانات المستلم" />
        <RecipientBlock fields={fields} dual={template.dual} labels={labels} />
      </section>

      <section className="mb-4">
        <SectionHeading title="ثانياً: بيانات الوحدة" />
        <ArabicParagraph text={interpolateHandoverText(template.section2, fields)} />
      </section>

      <section className="mb-4">
        <SectionHeading title="إقرار" />
        <ArabicParagraph text={declaration} />
      </section>

      <section className="mb-4">
        <SectionHeading title={template.violationsIntro} />
        <ArabicParagraph text={violations.join(" ")} />
        {insurance ? <ArabicParagraph text={insurance} /> : null}
      </section>

      <SignatureFooter
        dual={template.dual}
        labels={{
          client: template.dual ? "توقيع المشتري الأول" : "توقيع المشتري",
          client2: template.dual ? "توقيع المشتري الثاني" : undefined,
          company: "توقيع الشركة",
        }}
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
  const headerAr = interpolateHandoverText(template.header, fields);
  const headerBody = headerAr.split("إنه").slice(1).join("إنه").trim();

  const labels = {
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
        <h1 className="text-[14pt] font-bold text-[#0d4a6b]">محضر استلام وحدة سياحية</h1>
        <p className="mt-1 text-[11pt] font-semibold">بمشروع قرية (جورا)</p>
        <p className="text-[9.5pt] text-black/75">بمنطقة (الجلالة – العين السخنة)</p>
        {headerBody ? (
          <p className="mt-2 text-[9pt] leading-relaxed text-black/80">{headerBody}</p>
        ) : null}
      </HandoverProtocolHeader>

      <section className="mb-4">
        <RecipientBlock fields={fields} dual={template.dual} labels={labels} />
      </section>

      {template.parts.map((part) => {
        const titleAr = part.text.split(/(?<=:)/)[0]?.trim() ?? part.key;
        return (
          <section key={part.key} className="mb-3">
            <SectionHeading title={titleAr} />
            <ArabicParagraph text={interpolateHandoverText(part.text, fields)} />
          </section>
        );
      })}

      <SignatureFooter
        dual={template.dual}
        labels={{
          client: template.dual ? "توقيع المالك الأول" : "توقيع المالك",
          client2: template.dual ? "توقيع المالك الثاني" : undefined,
          company: "توقيع الشركة",
        }}
        companyAddress={companyAddress}
      />
    </>
  );
}

function SignatureFooter({
  dual,
  labels,
  companyAddress,
}: {
  dual: boolean;
  labels: { client: string; client2?: string; company: string };
  companyAddress: string;
}) {
  return (
    <footer
      className={`handover-signatures mt-6 grid gap-6 border-t border-black/20 pt-5 text-[9pt] ${
        dual ? "grid-cols-3" : "grid-cols-2"
      }`}
    >
      <SignatureCell label={labels.client} />
      {dual && labels.client2 ? <SignatureCell label={labels.client2} /> : null}
      <SignatureCell label={labels.company} footer={companyAddress} />
    </footer>
  );
}

function SignatureCell({
  label,
  footer,
}: {
  label: string;
  footer?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="font-semibold">{label}</p>
      <div className="mt-8 min-h-[1.25rem] border-b border-black/60" />
      {footer ? <p className="text-[8pt] leading-snug text-black/55">{footer}</p> : null}
    </div>
  );
}

export function HandoverProtocolDocument({ data }: { data: HandoverPrintPayload }) {
  return (
    <article
      dir="rtl"
      lang="ar"
      className="handover-print-sheet mx-auto w-[210mm] bg-white px-[14mm] py-[12mm] font-[family-name:var(--font-cairo)] text-black shadow-premium print:m-0 print:w-full print:max-w-none print:px-[12mm] print:py-[10mm] print:shadow-none"
    >
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
