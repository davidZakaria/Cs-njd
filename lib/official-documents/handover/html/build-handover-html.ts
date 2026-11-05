import fs from "node:fs";
import path from "node:path";

import {
  formatGreenAvenueHeader,
  interpolateHandoverText,
  splitViolationItems,
} from "@/lib/print/handover-templates/fields";
import { loadHandoverTemplate } from "@/lib/print/handover-templates/resolve";
import type {
  GreenAvenueTemplate,
  HandoverFieldValues,
  HandoverTemplateKey,
  JuraTemplate,
} from "@/lib/print/handover-templates/types";

import { HANDOVER_PRINT_CSS } from "./styles";
import { escapeHtml, toHandoverHtml } from "./utils";

const ARABIC_FONT_PATH = "lib/official-documents/assets/NotoNaskhArabic-Regular.ttf";
const NJD_LOGO_PATH = "public/brand/j-communities-light.png";

export function buildOfficialHandoverHtml(input: {
  templateKey: HandoverTemplateKey;
  fields: HandoverFieldValues;
  watermarkDraft: boolean;
}): string {
  const template = loadHandoverTemplate(input.templateKey);
  const fontDataUri = loadFileDataUri(ARABIC_FONT_PATH, "font/ttf");
  const logoDataUri = loadFileDataUri(NJD_LOGO_PATH, "image/png");

  const body =
    template.kind === "green-avenue"
      ? buildGreenAvenueBody(template, input.fields)
      : buildJuraBody(template, input.fields);

  const watermark = input.watermarkDraft
    ? '<div class="watermark" aria-hidden="true">مسودة — DRAFT</div>'
    : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <style>
    @font-face {
      font-family: "HandoverArabic";
      src: url("${fontDataUri}") format("truetype");
      font-weight: normal;
      font-style: normal;
    }
    ${HANDOVER_PRINT_CSS}
  </style>
</head>
<body>
  <div class="page-frame">
    ${watermark}
    <div class="page-content">
      ${buildHeaderHtml(logoDataUri, template, input.fields)}
      ${body}
    </div>
  </div>
</body>
</html>`;
}

function loadFileDataUri(relativePath: string, mime: string): string {
  const bytes = fs.readFileSync(path.join(process.cwd(), relativePath));
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function buildHeaderHtml(
  logoDataUri: string,
  template: GreenAvenueTemplate | JuraTemplate,
  fields: HandoverFieldValues
): string {
  if (template.kind === "green-avenue") {
    const header = formatGreenAvenueHeader(template.header);
    return `
      <header class="doc-header">
        <img class="doc-logo" src="${logoDataUri}" alt="NJD" />
        <div class="title-block">
          <div class="title-line">${escapeHtml(header.title)}</div>
          <div class="title-line-sm">${escapeHtml(header.project)}</div>
          <div class="title-line-sm">${escapeHtml(header.location)}</div>
        </div>
      </header>`;
  }

  const headerText = interpolateHandoverText(template.header, fields);
  const dateMatch = headerText.match(
    /إنه في يوم:[\s\S]*?(?=\d-أقـر|$)/
  );
  const dateLine = dateMatch ? dateMatch[0].trim() : "";

  return `
    <header class="doc-header">
      <img class="doc-logo" src="${logoDataUri}" alt="NJD" />
      <div class="title-block">
        <div class="title-line">محضر استلام وحدة سياحية</div>
        <div class="title-line-sm">بمشروع قرية (جورا)</div>
        <div class="title-line-sm">بمنطقة (الجلالة – العين السخنة)</div>
        ${dateLine ? `<div class="date-line">${toHandoverHtml(dateLine)}</div>` : ""}
      </div>
    </header>`;
}

function buildGreenAvenueBody(
  template: GreenAvenueTemplate,
  fields: HandoverFieldValues
): string {
  const section2 = interpolateHandoverText(template.section2, fields);
  const declaration = interpolateHandoverText(template.declaration, fields);
  const { intro, introIdLine, mainBody, closing } = splitGreenDeclaration(declaration);
  const violations = splitViolationItems(
    interpolateHandoverText(template.violationsBody, fields)
  );
  const insurance = template.insurance
    ? interpolateHandoverText(template.insurance, fields)
    : null;

  const section1Html = template.dual
    ? buildGreenDualRecipient(fields)
    : buildGreenSingleRecipient(fields);

  const violationHtml = violations
    .map((chunk) => `<p class="justified">${toHandoverHtml(chunk)}</p>`)
    .join("\n");

  return `
    ${section1Html}
    <h2 class="section-heading">ثانيا : بيانات الوحدة</h2>
    <p class="justified">${toHandoverHtml(section2)}</p>
    <h2 class="declaration-title">إقرار</h2>
    ${intro ? `<p class="declaration-intro">${toHandoverHtml(intro)}</p>` : ""}
    ${introIdLine ? `<p class="declaration-intro-center">${toHandoverHtml(introIdLine)}</p>` : ""}
    ${mainBody ? `<p class="justified">${toHandoverHtml(mainBody)}</p>` : ""}
    ${closing ? `<p class="closing-line">${toHandoverHtml(closing)}</p>` : ""}
    ${buildDeclarantSignatureBlock(template.dual)}
    <h2 class="section-heading">${escapeHtml(template.violationsIntro)}</h2>
    ${violationHtml}
    ${insurance ? `<p class="justified page-break">${toHandoverHtml(insurance)}</p>` : ""}
    ${template.dual ? buildDualBuyerSignatures() : ""}
  `;
}

function buildGreenSingleRecipient(fields: HandoverFieldValues): string {
  return `
    <h2 class="section-heading">اولا : - بيانات المستلم</h2>
    <p class="field-line"><span class="field-label">الاسم :</span> <span class="field-value">${toHandoverHtml(fields.clientName)}</span></p>
    <p class="field-line">
      <span class="field-label">الجنسيه :</span> <span class="field-value">${toHandoverHtml(fields.nationality)}</span>
      &nbsp;&nbsp;&nbsp;
      <span class="field-label">بطاقة الرقم القومى :</span> <span class="field-value">${toHandoverHtml(fields.nationalId)}</span>
    </p>
    <p class="field-line"><span class="field-label">المقيم في :</span> <span class="field-value">${toHandoverHtml(fields.address)}</span></p>
    <div class="field-row-spread">
      <span><span class="field-label">تليفون 1:</span> <span class="field-value">${toHandoverHtml(fields.phone1)}</span></span>
      <span><span class="field-label">تليفون 2:</span> <span class="field-value">${toHandoverHtml(fields.phone2)}</span></span>
      <span><span class="field-label">البريد الالكتروني :</span> <span class="field-value">${toHandoverHtml(fields.email)}</span></span>
    </div>`;
}

function buildGreenDualRecipient(fields: HandoverFieldValues): string {
  const owner2Name = fields.clientName2 ?? "—";
  const owner2Id = fields.nationalId2 ?? "—";
  return `
    <h2 class="section-heading">اولا : - بيانات المستلم</h2>
    <div class="owner-block">
      <p class="field-line"><span class="field-label">1-الاسم :</span> <span class="field-value">${toHandoverHtml(fields.clientName)}</span></p>
      <p class="field-line">
        <span class="field-label">الجنسيه :</span> <span class="field-value">${toHandoverHtml(fields.nationality)}</span>
        &nbsp;&nbsp;
        <span class="field-label">بطاقة الرقم القومى :</span> <span class="field-value">${toHandoverHtml(fields.nationalId)}</span>
      </p>
      <p class="field-line"><span class="field-label">المقيم في :</span> <span class="field-value">${toHandoverHtml(fields.address)}</span></p>
      <div class="field-row-spread">
        <span><span class="field-label">تليفون 1:</span> <span class="field-value">${toHandoverHtml(fields.phone1)}</span></span>
        <span><span class="field-label">البريد الالكتروني :</span> <span class="field-value">${toHandoverHtml(fields.email)}</span></span>
      </div>
    </div>
    <div class="owner-block">
      <p class="field-line"><span class="field-label">2-الاسم :</span> <span class="field-value">${toHandoverHtml(owner2Name)}</span></p>
      <p class="field-line">
        <span class="field-label">الجنسيه :</span> <span class="field-value">${toHandoverHtml(fields.nationality)}</span>
        &nbsp;&nbsp;
        <span class="field-label">بطاقة الرقم القومى :</span> <span class="field-value">${toHandoverHtml(owner2Id)}</span>
      </p>
    </div>`;
}

function splitGreenDeclaration(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const bodyStart = normalized.search(/بأننى|بأنني|بانني/i);
  let introPart =
    bodyStart > 0 ? normalized.slice(0, bodyStart).trim() : normalized;
  let rest = bodyStart > 0 ? normalized.slice(bodyStart).trim() : "";

  let intro = introPart;
  let introIdLine = "";
  const idMarker = introPart.match(/(أحمل بطاق[eh] رقم قوم[ىي]:?\s*[\d⟦\w]+)/i);
  if (idMarker) {
    intro = introPart.slice(0, idMarker.index).trim();
    introIdLine = idMarker[1] ?? "";
  }

  const closingMarker = "هذا اقرار منى بذلك";
  const closeIdx = rest.indexOf(closingMarker);
  let mainBody = rest;
  let closing = "";
  if (closeIdx >= 0) {
    mainBody = rest.slice(0, closeIdx).trim();
    closing = rest.slice(closeIdx).trim();
  }
  if (!rest && bodyStart <= 0) {
    return { intro: normalized, introIdLine: "", mainBody: "", closing: "" };
  }
  return { intro, introIdLine, mainBody, closing };
}

function buildDeclarantSignatureBlock(_dual: boolean): string {
  return `
    <div class="signature-block">
      <p class="signature-heading">المقر بما فيه</p>
      <div class="signature-row">
        <div class="signature-cell">
          <span class="label">الاسم :</span><span class="dotted-line"></span>
        </div>
        <div class="signature-cell">
          <span class="label">التوقيع :</span><span class="dotted-line"></span>
        </div>
      </div>
    </div>`;
}

function buildDualBuyerSignatures(): string {
  return `
    <div class="signature-block page-break">
      <div class="signature-row">
        <div class="signature-cell">
          <span class="label">توقيع المشتري الأول</span><span class="dotted-line"></span>
        </div>
        <div class="signature-cell">
          <span class="label">توقيع المشتري الثاني</span><span class="dotted-line"></span>
        </div>
        <div class="signature-cell">
          <span class="label">توقيع الشركة</span><span class="dotted-line"></span>
        </div>
      </div>
    </div>`;
}

function buildJuraBody(template: JuraTemplate, fields: HandoverFieldValues): string {
  const partsHtml = template.parts
    .map((part) => {
      const text = interpolateHandoverText(part.text, fields);
      const heading = juraPartHeading(part.key, text);
      const body = stripJuraHeadingPrefix(text);
      return `
        <h2 class="section-heading">${escapeHtml(heading)}</h2>
        <p class="justified">${toHandoverHtml(body)}</p>`;
    })
    .join("\n");

  return `
    ${partsHtml}
    ${buildDeclarantSignatureBlock(template.dual)}
    ${template.dual ? buildDualBuyerSignatures() : buildJuraSingleSignatures()}
  `;
}

function buildJuraSingleSignatures(): string {
  return `
    <div class="signature-row">
      <div class="signature-cell">
        <span class="label">توقيع المالك</span><span class="dotted-line"></span>
      </div>
      <div class="signature-cell">
        <span class="label">توقيع الشركة</span><span class="dotted-line"></span>
      </div>
    </div>`;
}

function juraPartHeading(partKey: string, text: string): string {
  if (partKey === "intro") return "أولاً";
  const inline = text.match(/^([^\s]{2,24}\s*:)/);
  if (inline) return inline[1]!.replace(/\s*:$/, "").trim();
  return partKey.replace(/:$/, "").trim();
}

function stripJuraHeadingPrefix(text: string): string {
  return text.replace(/^([^\s]{2,24}\s*:)\s*/, "").trim() || text;
}
