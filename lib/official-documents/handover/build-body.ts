import {
  interpolateHandoverText,
  splitViolationItems,
} from "@/lib/print/handover-templates/fields";
import { splitJuraSectionHeadingBody } from "@/lib/official-documents/handover/html/jura-sections";
import { stripGreenSection1Lead, stripGreenSection2Lead } from "@/lib/official-documents/handover/html/utils";
import { loadHandoverTemplate } from "@/lib/print/handover-templates/resolve";
import type {
  GreenAvenueTemplate,
  HandoverTemplateContent,
  HandoverTemplateKey,
  JuraTemplate,
} from "@/lib/print/handover-templates/types";

import type { HandoverFieldValues } from "@/lib/print/handover-templates/types";

function section(title: string, body: string): string {
  return `${title}\n\n${body}`.trim();
}

export function buildOfficialHandoverDraftBody(input: {
  templateKey: HandoverTemplateKey;
  fields: HandoverFieldValues;
}): string {
  const template = loadHandoverTemplate(input.templateKey);
  return serializeHandoverTemplateBody(template, input.fields);
}

export function serializeHandoverTemplateBody(
  template: HandoverTemplateContent,
  fields: HandoverFieldValues
): string {
  if (template.kind === "green-avenue") {
    return serializeGreenAvenue(template, fields);
  }
  return serializeJura(template, fields);
}

function greenDualOwnerBlockLines(fields: HandoverFieldValues, owner: 1 | 2): string[] {
  const isFirst = owner === 1;
  const name = isFirst ? fields.clientName : (fields.clientName2 ?? "—");
  const nationalId = isFirst ? fields.nationalId : (fields.nationalId2 ?? "—");
  const nationality = isFirst ? fields.nationality : (fields.nationality2 ?? fields.nationality);
  const address = isFirst ? fields.address : (fields.address2 ?? "—");
  const phone1 = isFirst ? fields.phone1 : (fields.phone1Owner2 ?? "—");
  const phone2 = isFirst ? fields.phone2 : (fields.phone2Owner2 ?? "—");
  const email = isFirst ? fields.email : (fields.emailOwner2 ?? "—");
  const prefix = isFirst ? "1" : "2";
  return [
    `${prefix}-الاسم : ${name}`,
    `الجنسيه : ${nationality}     بطاقة الرقم القومى : ${nationalId}`,
    `المقيم في : ${address} تليفون 1: ${phone1}                                    تليفون 2: ${phone2}                                       البريد الالكتروني : ${email}`,
  ];
}

function serializeGreenDualSection1(fields: HandoverFieldValues): string {
  return [...greenDualOwnerBlockLines(fields, 1), ...greenDualOwnerBlockLines(fields, 2)].join(
    "\n"
  );
}

function serializeGreenSingleSection1(fields: HandoverFieldValues): string {
  return [
    `الاسم : ${fields.clientName}`,
    `الجنسيه : ${fields.nationality}     بطاقة الرقم القومى : ${fields.nationalId}`,
    `المقيم في : ${fields.address} تليفون 1: ${fields.phone1}                                    تليفون 2: ${fields.phone2}                                       البريد الالكتروني : ${fields.email}`,
  ].join("\n");
}

/** Single newline after title so draft chunking keeps titled sections with body. */
function greenSectionChunk(title: string, body: string): string {
  return `${title}\n${body}`.trim();
}

function greenDeclarationChunk(title: string, body: string): string {
  return greenSectionChunk(title, body);
}

function serializeGreenDualDeclaration(
  template: GreenAvenueTemplate,
  fields: HandoverFieldValues
): string {
  const interpolated = interpolateHandoverText(template.declaration, fields);
  const bodyStart = interpolated.search(/بأننى|بأنني|بانني/i);
  const rest = bodyStart >= 0 ? interpolated.slice(bodyStart).trim() : interpolated.trim();
  const intro = [
    `أقر أنا الموقع أدناه / ${fields.clientName} أحمل بطاقه رقم قومى: ${fields.nationalId}`,
    `أقر أنا الموقع أدناه / ${fields.clientName2 ?? "—"} أحمل بطاقه رقم قومى: ${fields.nationalId2 ?? "—"}`,
  ].join("");
  return `${intro}${rest}`;
}

function serializeGreenAvenue(
  template: GreenAvenueTemplate,
  fields: HandoverFieldValues
): string {
  const headerLines = template.header
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  const section1 = template.dual
    ? serializeGreenDualSection1(fields)
    : serializeGreenSingleSection1(fields);
  const section2 = stripGreenSection2Lead(
    interpolateHandoverText(template.section2, fields)
  );
  const declaration = template.dual
    ? serializeGreenDualDeclaration(template, fields)
    : interpolateHandoverText(template.declaration, fields);
  const violations = splitViolationItems(
    interpolateHandoverText(template.violationsBody, fields)
  ).join(" ");
  const insurance = template.insurance
    ? interpolateHandoverText(template.insurance, fields)
    : null;

  const chunks = [
    headerLines,
    greenSectionChunk("أولاً: بيانات المستلم", section1),
    greenSectionChunk("ثانياً: بيانات الوحدة", section2),
    greenDeclarationChunk("إقرار", declaration),
    section(template.violationsIntro, violations),
  ];
  if (insurance) {
    chunks.push(insurance);
  }
  return chunks.filter(Boolean).join("\n\n");
}

function serializeJura(template: JuraTemplate, fields: HandoverFieldValues): string {
  const header = interpolateHandoverText(template.header, fields);
  const parts = template.parts.map((part) => {
    const text = interpolateHandoverText(part.text, fields);
    if (part.key.trim() === "intro") {
      return section("أولاً", text);
    }
    const { heading, body } = splitJuraSectionHeadingBody(text);
    if (heading && body) {
      return `${heading}\n\n${body}`;
    }
    return text.trim();
  });
  return [header, ...parts].filter(Boolean).join("\n\n");
}

export function handoverDraftTitleForKey(key: HandoverTemplateKey): string {
  if (key.startsWith("jura")) {
    return "محضر استلام وحدة سياحية — جورا";
  }
  return "محضر تسليم وحدة السكنية — جرين أفينيو";
}
