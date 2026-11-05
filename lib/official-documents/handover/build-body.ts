import {
  interpolateHandoverText,
  splitViolationItems,
} from "@/lib/print/handover-templates/fields";
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

function serializeGreenAvenue(
  template: GreenAvenueTemplate,
  fields: HandoverFieldValues
): string {
  const headerLines = template.header
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  const section1 = interpolateHandoverText(template.section1, fields);
  const section2 = interpolateHandoverText(template.section2, fields);
  const declaration = interpolateHandoverText(template.declaration, fields);
  const violations = splitViolationItems(
    interpolateHandoverText(template.violationsBody, fields)
  ).join(" ");
  const insurance = template.insurance
    ? interpolateHandoverText(template.insurance, fields)
    : null;

  const chunks = [
    headerLines,
    section("أولاً: بيانات المستلم", section1),
    section("ثانياً: بيانات الوحدة", section2),
    section("إقرار", declaration),
    section(template.violationsIntro, violations),
  ];
  if (insurance) {
    chunks.push(insurance);
  }
  return chunks.filter(Boolean).join("\n\n");
}

function serializeJura(template: JuraTemplate, fields: HandoverFieldValues): string {
  const header = interpolateHandoverText(template.header, fields);
  const parts = template.parts.map((part) =>
    section(part.key, interpolateHandoverText(part.text, fields))
  );
  return [header, ...parts].filter(Boolean).join("\n\n");
}

export function handoverDraftTitleForKey(key: HandoverTemplateKey): string {
  if (key.startsWith("jura")) {
    return "محضر استلام وحدة سياحية — جورا";
  }
  return "محضر تسليم وحدة السكنية — جرين أفينيو";
}
