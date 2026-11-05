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

import { handoverLogoAssetRelativePath } from "@/lib/official-documents/handover/constants";
import {
  greenAvenueBodyChunksWithoutHeader,
  isHandoverDraftAppendixChunk,
  mergeTrailingHandoverAppendixChunks,
  splitHandoverDraftChunks,
} from "@/lib/official-documents/handover/draft-body-structure";
import {
  buildJuraOwnerBlock,
  splitJuraIntroText,
  splitJuraSectionHeadingBody,
} from "./jura-sections";
import { HANDOVER_PRINT_CSS } from "./styles";
import {
  escapeHtml,
  formatLtrField,
  stripGreenDualDeclarationPreamble,
  stripGreenSection1Lead,
  stripGreenSection2Lead,
  toHandoverHtml,
} from "./utils";

const ARABIC_FONT_PATH = "lib/official-documents/assets/NotoNaskhArabic-Regular.ttf";

export function buildOfficialHandoverHtml(input: {
  templateKey: HandoverTemplateKey;
  fields: HandoverFieldValues;
  watermarkDraft: boolean;
  /** When set, user-edited draft text drives document body content in the PDF. */
  draftBody?: string;
}): string {
  const template = loadHandoverTemplate(input.templateKey);
  const fontDataUri = loadFileDataUri(ARABIC_FONT_PATH, "font/ttf");
  const logoRelative = handoverLogoAssetRelativePath(input.templateKey);
  const logoDataUri = loadFileDataUri(
    logoRelative,
    logoRelative.endsWith(".jpg") ? "image/jpeg" : "image/png"
  );

  const body = input.draftBody?.trim()
    ? buildBodyFromEditedDraftText(template, input.fields, input.draftBody)
    : template.kind === "green-avenue"
      ? buildGreenAvenueBody(template, input.fields)
      : buildJuraBody(template, input.fields);

  const watermark = input.watermarkDraft
    ? '<div class="watermark" aria-hidden="true">مسودة — DRAFT</div>'
    : "";

  const docClass = input.templateKey.startsWith("jura")
    ? "handover-jura"
    : "handover-green";

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
<body class="${docClass}">
  ${watermark}
  <div class="print-frame print-frame-outer" aria-hidden="true"></div>
  <div class="print-frame print-frame-inner" aria-hidden="true"></div>
  <div class="doc-body">
    ${buildHeaderHtml(logoDataUri, template, input.fields)}
    ${body}
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
  const dateMatch = headerText.match(/إنه في يوم:[\s\S]*?(?=\d-أقـر|$)/);
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
  const section2 = stripGreenSection2Lead(
    interpolateHandoverText(template.section2, fields)
  );
  const declaration = interpolateHandoverText(template.declaration, fields);
  const { intro, introIdLine, mainBody, closing } = splitGreenDeclaration(
    template.dual ? stripGreenDualDeclarationPreamble(declaration) : declaration
  );
  const violations = splitViolationItems(
    interpolateHandoverText(template.violationsBody, fields)
  );
  const insurance = template.insurance
    ? interpolateHandoverText(template.insurance, fields)
    : null;

  const section1Html = template.dual
    ? buildGreenDualRecipient(fields)
    : buildGreenSingleRecipient(fields);

  const declarationIntroHtml = template.dual
    ? buildGreenDualDeclarationIntro(fields)
    : buildGreenSingleDeclarationIntro(intro, introIdLine);

  const violationHtml = `<div class="violations-block">${violations
    .map((chunk) => `<p class="justified">${toHandoverHtml(chunk)}</p>`)
    .join("\n")}</div>`;

  return `
    ${section1Html}
    <h2 class="section-heading">ثانيا : بيانات الوحدة</h2>
    <p class="justified">${toHandoverHtml(section2)}</p>
    <h2 class="declaration-title">إقرار</h2>
    ${declarationIntroHtml}
    ${mainBody ? `<p class="justified">${toHandoverHtml(mainBody)}</p>` : ""}
    ${closing ? `<p class="closing-line">${toHandoverHtml(closing)}</p>` : ""}
    ${buildDeclarantSignatureBlock()}
    <h2 class="section-heading">${escapeHtml(template.violationsIntro)}</h2>
    ${violationHtml}
    ${insurance ? `<p class="justified insurance-block">${toHandoverHtml(insurance)}</p>` : ""}
    ${template.dual ? buildGreenDualClosingSignatures() : ""}
  `;
}

function buildGreenSingleRecipient(fields: HandoverFieldValues): string {
  return `
    <h2 class="section-heading">اولا : - بيانات المستلم</h2>
    <p class="field-line"><span class="field-label">الاسم :</span> <span class="field-value">${toHandoverHtml(fields.clientName)}</span></p>
    <p class="field-line">
      <span class="field-label">الجنسيه :</span> <span class="field-value">${toHandoverHtml(fields.nationality)}</span>
      &nbsp;&nbsp;&nbsp;
      <span class="field-label">بطاقة الرقم القومى :</span> ${formatLtrField(fields.nationalId)}
    </p>
    <p class="field-line"><span class="field-label">المقيم في :</span> <span class="field-value">${toHandoverHtml(fields.address)}</span></p>
    <p class="field-line"><span class="field-label">تليفون 1:</span> ${formatLtrField(fields.phone1)}</p>
    <p class="field-line"><span class="field-label">تليفون 2:</span> ${formatLtrField(fields.phone2)}</p>
    <p class="field-line"><span class="field-label">البريد الالكتروني :</span> ${formatLtrField(fields.email)}</p>`;
}

function buildGreenDualRecipient(fields: HandoverFieldValues): string {
  const owner2Name = fields.clientName2 ?? "—";
  const owner2Id = fields.nationalId2 ?? "—";
  const owner2Nat = fields.nationality2 ?? fields.nationality;
  const owner2Address = fields.address2 ?? "—";
  const owner2Phone1 = fields.phone1Owner2 ?? "—";
  const owner2Phone2 = fields.phone2Owner2 ?? "—";
  const owner2Email = fields.emailOwner2 ?? "—";

  return `
    <h2 class="section-heading">اولا : - بيانات المستلم</h2>
    <div class="owner-block">
      <p class="field-line"><span class="field-label">1-الاسم :</span> <span class="field-value">${toHandoverHtml(fields.clientName)}</span></p>
      <p class="field-line">
        <span class="field-label">الجنسيه :</span> <span class="field-value">${toHandoverHtml(fields.nationality)}</span>
        &nbsp;&nbsp;
        <span class="field-label">بطاقة الرقم القومى :</span> ${formatLtrField(fields.nationalId)}
      </p>
      <p class="field-line"><span class="field-label">المقيم في :</span> <span class="field-value">${toHandoverHtml(fields.address)}</span></p>
      <p class="field-line"><span class="field-label">تليفون 1:</span> ${formatLtrField(fields.phone1)}</p>
      <p class="field-line"><span class="field-label">تليفون 2:</span> ${formatLtrField(fields.phone2)}</p>
      <p class="field-line"><span class="field-label">البريد الالكتروني :</span> ${formatLtrField(fields.email)}</p>
    </div>
    <div class="owner-block">
      <p class="field-line"><span class="field-label">2-الاسم :</span> <span class="field-value">${toHandoverHtml(owner2Name)}</span></p>
      <p class="field-line">
        <span class="field-label">الجنسيه :</span> <span class="field-value">${toHandoverHtml(owner2Nat)}</span>
        &nbsp;&nbsp;
        <span class="field-label">بطاقة الرقم القومى :</span> ${formatLtrField(owner2Id)}
      </p>
      <p class="field-line"><span class="field-label">المقيم في :</span> <span class="field-value">${toHandoverHtml(owner2Address)}</span></p>
      <p class="field-line"><span class="field-label">تليفون 1:</span> ${formatLtrField(owner2Phone1)}</p>
      <p class="field-line"><span class="field-label">تليفون 2:</span> ${formatLtrField(owner2Phone2)}</p>
      <p class="field-line"><span class="field-label">البريد الالكتروني :</span> ${formatLtrField(owner2Email)}</p>
    </div>`;
}

function buildGreenDualDeclarationIntro(fields: HandoverFieldValues): string {
  return `
    <p class="declaration-intro">${escapeHtml("أقر أنا الموقع أدناه /")} <span class="field-value">${toHandoverHtml(fields.clientName)}</span> ${escapeHtml("أحمل بطاقة رقم قومى:")} ${formatLtrField(fields.nationalId)}</p>
    <p class="declaration-intro">${escapeHtml("أقر أنا الموقع أدناه /")} <span class="field-value">${toHandoverHtml(fields.clientName2 ?? "—")}</span> ${escapeHtml("أحمل بطاقة رقم قومى:")} ${formatLtrField(fields.nationalId2 ?? "—")}</p>`;
}

function buildGreenSingleDeclarationIntro(
  intro: string,
  introIdLine: string
): string {
  let html = "";
  if (intro) {
    html += `<p class="declaration-intro">${toHandoverHtml(intro)}</p>`;
  }
  if (introIdLine) {
    const idMatch = introIdLine.match(/(أحمل بطاق[eh] رقم قوم[ىي]:?\s*)([\s\S]+)/i);
    if (idMatch) {
      html += `<p class="declaration-intro-center">${escapeHtml(idMatch[1]!)}${formatLtrField(idMatch[2]!.trim())}</p>`;
    } else {
      html += `<p class="declaration-intro-center">${toHandoverHtml(introIdLine)}</p>`;
    }
  }
  return html;
}

function splitGreenDeclaration(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const bodyStart = normalized.search(/بأننى|بأنني|بانني/i);

  if (bodyStart < 0) {
    return { intro: normalized, introIdLine: "", mainBody: "", closing: "" };
  }

  const introPart = bodyStart > 0 ? normalized.slice(0, bodyStart).trim() : "";
  const rest = normalized.slice(bodyStart).trim();

  let intro = introPart;
  let introIdLine = "";
  if (introPart) {
    const idMarker = introPart.match(/(أحمل بطاق[eh] رقم قوم[ىy]:?\s*[\d⟦\w+\s]+)/i);
    if (idMarker) {
      intro = introPart.slice(0, idMarker.index).trim();
      introIdLine = idMarker[1] ?? "";
    }
  }

  const closingMarker = "هذا اقرار منى بذلك";
  const closeIdx = rest.indexOf(closingMarker);
  let mainBody = rest;
  let closing = "";
  if (closeIdx >= 0) {
    mainBody = rest.slice(0, closeIdx).trim();
    closing = rest.slice(closeIdx).trim();
  }

  return { intro, introIdLine, mainBody, closing };
}

function buildDeclarantSignatureBlock(options?: {
  dual?: boolean;
  ownerRows?: 1 | 2;
}): string {
  const rows =
    options?.ownerRows ?? (options?.dual ? 2 : 1);
  const ownerRowsHtml =
    rows === 2
      ? `
      <div class="signature-row">
        <div class="signature-cell">
          <span class="label">1-الاسم :</span><span class="dotted-line"></span>
        </div>
        <div class="signature-cell">
          <span class="label">التوقيع :</span><span class="dotted-line"></span>
        </div>
      </div>
      <div class="signature-row">
        <div class="signature-cell">
          <span class="label">2-الاسم :</span><span class="dotted-line"></span>
        </div>
        <div class="signature-cell">
          <span class="label">التوقيع :</span><span class="dotted-line"></span>
        </div>
      </div>`
      : `
      <div class="signature-row">
        <div class="signature-cell">
          <span class="label">الاسم :</span><span class="dotted-line"></span>
        </div>
        <div class="signature-cell">
          <span class="label">التوقيع :</span><span class="dotted-line"></span>
        </div>
      </div>`;

  return `
    <div class="signature-block">
      <p class="signature-heading">المقر بما فيه</p>
      ${ownerRowsHtml}
    </div>`;
}

function buildJuraClosingSignatures(dual: boolean): string {
  if (dual) {
    return `
      <div class="signature-block signature-block-closing">
        <div class="signature-row">
          <div class="signature-cell">
            <span class="label">توقيع المالك الأول</span><span class="dotted-line"></span>
          </div>
          <div class="signature-cell">
            <span class="label">توقيع المالك الثاني</span><span class="dotted-line"></span>
          </div>
        </div>
        <div class="signature-row">
          <div class="signature-cell">
            <span class="label">توقيع الشركة</span><span class="dotted-line"></span>
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="signature-block signature-block-closing">
      <div class="signature-row">
        <div class="signature-cell">
          <span class="label">توقيع المالك</span><span class="dotted-line"></span>
        </div>
        <div class="signature-cell">
          <span class="label">توقيع الشركة</span><span class="dotted-line"></span>
        </div>
      </div>
    </div>`;
}

function buildGreenDualClosingSignatures(): string {
  return `
    <div class="signature-block signature-block-closing">
      <div class="signature-row">
        <div class="signature-cell">
          <span class="label">توقيع المشتري الأول</span><span class="dotted-line"></span>
        </div>
        <div class="signature-cell">
          <span class="label">توقيع المشتري الثاني</span><span class="dotted-line"></span>
        </div>
      </div>
      <div class="signature-row">
        <div class="signature-cell">
          <span class="label">توقيع الشركة</span><span class="dotted-line"></span>
        </div>
      </div>
    </div>`;
}

function buildBodyFromEditedDraftText(
  template: GreenAvenueTemplate | JuraTemplate,
  fields: HandoverFieldValues,
  draftBody: string
): string {
  if (template.kind === "green-avenue") {
    return renderGreenAvenueDraftBodyHtml(template, fields, draftBody);
  }
  return renderJuraDraftBodyHtml(template, fields, draftBody);
}

const GREEN_SECTION1_HEADING = /^[أا]?ول(?:ا|اً)/u;

function renderGreenAvenueDraftBodyHtml(
  template: GreenAvenueTemplate,
  fields: HandoverFieldValues,
  draftBody: string
): string {
  const chunks = mergeTrailingHandoverAppendixChunks(
    greenAvenueBodyChunksWithoutHeader(splitHandoverDraftChunks(draftBody))
  );

  let html = "";
  let sawDeclarationSignatures = false;
  let renderedDualDeclaration = false;

  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const heading = lines[0]?.trim() ?? "";
    let bodyText = lines.slice(1).join("\n").trim();
    if (!bodyText && lines.length === 1) {
      bodyText = "";
    }

    if (
      template.dual &&
      GREEN_SECTION1_HEADING.test(heading) &&
      !bodyText &&
      lines.length === 1
    ) {
      html += `<h2 class="section-heading">${escapeHtml(heading.replace(/:$/, ""))}</h2>`;
      continue;
    }

    if (template.dual && /^1-الاسم/u.test(chunk.trim())) {
      html += buildGreenDualRecipient(fields).replace(
        /<h2 class="section-heading">[^<]+<\/h2>/,
        ""
      );
      continue;
    }

    if (GREEN_SECTION1_HEADING.test(heading)) {
      html += `<h2 class="section-heading">${escapeHtml(heading.replace(/:$/, ""))}</h2>`;
      if (template.dual) {
        html += buildGreenDualRecipient(fields).replace(
          /<h2 class="section-heading">[^<]+<\/h2>/,
          ""
        );
      } else {
        html += buildGreenSingleRecipient(fields).replace(
          /<h2 class="section-heading">[^<]+<\/h2>/,
          ""
        );
      }
      continue;
    }

    if (
      !template.dual &&
      /^الاسم\s*:/u.test(chunk.trim()) &&
      !/^1-الاسم/u.test(chunk.trim())
    ) {
      html += `<h2 class="section-heading">اولا : - بيانات المستلم</h2>`;
      html += buildGreenSingleRecipient(fields).replace(
        /<h2 class="section-heading">[^<]+<\/h2>/,
        ""
      );
      continue;
    }

    if (/^ثان/i.test(heading)) {
      const body = stripGreenSection2Lead(bodyText || chunk.replace(/^[^\n]+\n?/u, "").trim());
      html += `<h2 class="section-heading">${escapeHtml(heading)}</h2>`;
      html += `<p class="justified">${toHandoverHtml(body)}</p>`;
      continue;
    }

    if (/^إقرار/u.test(heading) || (template.dual && /^أقر أنا الموقع/u.test(chunk.trim()))) {
      const declarationSource = /^إقرار/u.test(heading)
        ? bodyText || chunk.replace(/^إقرار\s*/u, "").trim()
        : chunk.trim();
      html += `<h2 class="declaration-title">إقرار</h2>`;
      if (template.dual) {
        const mainSource = stripGreenDualDeclarationPreamble(declarationSource);
        const { mainBody, closing } = splitGreenDeclaration(mainSource);
        html += buildGreenDualDeclarationIntro(fields);
        if (mainBody) {
          html += `<p class="justified">${toHandoverHtml(mainBody)}</p>`;
        }
        if (closing) {
          html += `<p class="closing-line">${toHandoverHtml(closing)}</p>`;
        }
        renderedDualDeclaration = true;
      } else {
        html += `<p class="justified">${toHandoverHtml(declarationSource)}</p>`;
      }
      html += buildDeclarantSignatureBlock({ dual: template.dual });
      sawDeclarationSignatures = true;
      continue;
    }

    if (template.dual && renderedDualDeclaration && /^أقر أنا الموقع/u.test(chunk.trim())) {
      continue;
    }

    if (
      heading.includes(template.violationsIntro.slice(0, 10)) ||
      (/مخالف|الإلتزامات/u.test(chunk) && !/تأمين/u.test(chunk))
    ) {
      const violationText =
        bodyText ||
        chunk.replace(new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), "").trim() ||
        chunk;
      const violations = splitViolationItems(violationText);
      html += `<h2 class="section-heading">${escapeHtml(template.violationsIntro)}</h2>`;
      html += `<div class="violations-block">${violations
        .map((part) => `<p class="justified">${toHandoverHtml(part)}</p>`)
        .join("\n")}</div>`;
      continue;
    }

    if (/تأمين|التشطيبات/u.test(chunk)) {
      if (!template.insurance) {
        continue;
      }
      let insuranceText = chunk.trim();
      if (bodyText && isHandoverDraftAppendixChunk(bodyText)) {
        insuranceText = `${heading}\n\n${bodyText}`.trim();
      } else if (bodyText) {
        insuranceText = bodyText;
      }
      html += `<p class="justified insurance-block">${toHandoverHtml(insuranceText)}</p>`;
      continue;
    }

    if (heading && bodyText) {
      html += `<p class="justified">${toHandoverHtml(chunk)}</p>`;
    } else {
      html += `<p class="justified">${toHandoverHtml(chunk)}</p>`;
    }
  }

  if (!sawDeclarationSignatures) {
    html += buildDeclarantSignatureBlock({ dual: template.dual });
  }
  if (template.dual) {
    html += buildGreenDualClosingSignatures();
  }

  return html;
}

function juraParagraphBody(heading: string, body: string, chunk: string): string {
  if (body.trim()) return body;
  const flat = chunk.replace(/\n+/g, " ").trim();
  if (heading && flat.startsWith(heading)) {
    return flat.slice(heading.length).trim();
  }
  return flat;
}

function renderJuraDraftBodyHtml(
  template: JuraTemplate,
  _fields: HandoverFieldValues,
  draftBody: string
): string {
  void _fields;
  const bodyChunks = greenAvenueBodyChunksWithoutHeader(
    splitHandoverDraftChunks(draftBody)
  );

  let html = "";

  for (let i = 0; i < bodyChunks.length; i++) {
    const chunk = bodyChunks[i]!;
    const isLast = i === bodyChunks.length - 1;

    if (/^أولاً|^1-/u.test(chunk.split("\n")[0]?.trim() ?? "") || /^أولاً/u.test(chunk)) {
      const body = chunk
        .replace(/^أولاً\s*:?\s*/u, "")
        .replace(/^1-\s*/u, "")
        .trim();
      html += `<h2 class="section-heading">أولاً</h2>`;
      html += `<p class="justified">${toHandoverHtml(body)}</p>`;
      continue;
    }

    const { heading, body } = splitJuraSectionHeadingBody(
      chunk.replace(/\n+/g, " ").trim()
    );
    const displayHeading = heading || chunk.split("\n")[0]?.trim() || "";
    const isThalitha = /ثالث/u.test(displayHeading);

    if (isThalitha) {
      html += `<div class="jura-thalitha-wrap">`;
      html += `<h2 class="section-heading">${escapeHtml(displayHeading)}</h2>`;
      html += `<p class="justified section-body">${toHandoverHtml(juraParagraphBody(displayHeading, body, chunk))}</p>`;
      html += buildDeclarantSignatureBlock({
        dual: template.dual,
        ownerRows: template.dual ? 2 : 1,
      });
      html += `</div>`;
      continue;
    }

    if (isLast) {
      html += `<div class="jura-finale">`;
      html += `<h2 class="section-heading">${escapeHtml(displayHeading)}</h2>`;
      html += `<p class="justified section-body">${toHandoverHtml(juraParagraphBody(displayHeading, body, chunk))}</p>`;
      html += buildJuraClosingSignatures(template.dual);
      html += `</div>`;
      continue;
    }

    html += `<h2 class="section-heading">${escapeHtml(displayHeading)}</h2>`;
    html += `<p class="justified section-body">${toHandoverHtml(juraParagraphBody(displayHeading, body, chunk))}</p>`;
  }

  return html;
}



function buildJuraBody(template: JuraTemplate, fields: HandoverFieldValues): string {
  const introPart = template.parts.find((p) => p.key.trim() === "intro");
  const rest = template.parts.filter((p) => p.key.trim() !== "intro");

  let html = `<h2 class="section-heading">أولاً</h2>`;
  html += buildJuraOwnerBlock(fields, template.dual);

  if (introPart) {
    const { declarationBody } = splitJuraIntroText(introPart.text);
    if (declarationBody) {
      html += `<p class="justified">${toHandoverHtml(interpolateHandoverText(declarationBody, fields))}</p>`;
    }
  }

  for (let i = 0; i < rest.length; i++) {
    const part = rest[i]!;
    const isLast = i === rest.length - 1;
    const interpolated = interpolateHandoverText(part.text, fields);
    const { heading, body } = splitJuraSectionHeadingBody(interpolated);
    const isThalitha = /ثالث/u.test(part.key) || /ثالث/u.test(heading);

    if (isThalitha) {
      html += `<div class="jura-thalitha-wrap">`;
      html += `<h2 class="section-heading">${escapeHtml(heading)}</h2>`;
      html += `<p class="justified section-body">${toHandoverHtml(body)}</p>`;
      html += buildDeclarantSignatureBlock({
        dual: template.dual,
        ownerRows: template.dual ? 2 : 1,
      });
      html += `</div>`;
      continue;
    }

    if (isLast) {
      html += `<div class="jura-finale">`;
      html += `<h2 class="section-heading">${escapeHtml(heading)}</h2>`;
      html += `<p class="justified section-body">${toHandoverHtml(body)}</p>`;
      html += buildJuraClosingSignatures(template.dual);
      html += `</div>`;
      continue;
    }

    html += `<h2 class="section-heading">${escapeHtml(heading)}</h2>`;
    html += `<p class="justified section-body">${toHandoverHtml(body)}</p>`;
  }

  return html;
}
