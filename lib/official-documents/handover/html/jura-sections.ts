import type { HandoverFieldValues } from "@/lib/print/handover-templates/types";

import { escapeHtml, formatLtrField, toHandoverHtml } from "./utils";

export function splitJuraSectionHeadingBody(text: string): {
  heading: string;
  body: string;
} {
  const t = text.trim();
  const parenSplit = t.match(/^(.+?\))\s*([\s\S]+)$/);
  if (
    parenSplit &&
    parenSplit[1].includes(":") &&
    parenSplit[1].length < 120 &&
    !parenSplit[1].includes("أقر")
  ) {
    return { heading: parenSplit[1].trim(), body: parenSplit[2].trim() };
  }

  const stuckIdx = t.search(/(?<=[^\s])أقر/u);
  if (stuckIdx > 0) {
    return {
      heading: t.slice(0, stuckIdx).trim(),
      body: t.slice(stuckIdx).trim(),
    };
  }

  const spacedIdx = t.search(/\s+(?:و\s*)?أقر\b/u);
  if (spacedIdx > 0) {
    return {
      heading: t.slice(0, spacedIdx).trim(),
      body: t.slice(spacedIdx).trim(),
    };
  }

  const colon = t.indexOf(":");
  if (colon > 0) {
    const lineEnd = t.indexOf(".", colon);
    if (lineEnd > colon) {
      return {
        heading: t.slice(0, lineEnd + 1).trim(),
        body: t.slice(lineEnd + 1).trim(),
      };
    }
  }

  return { heading: t, body: "" };
}

export function splitJuraIntroText(text: string): {
  ownerPrefix: string;
  declarationBody: string;
} {
  const idx = text.search(/بأنه|بأننه|بانه/u);
  if (idx <= 0) {
    return { ownerPrefix: text, declarationBody: "" };
  }
  return {
    ownerPrefix: text.slice(0, idx).trim(),
    declarationBody: text.slice(idx).trim(),
  };
}

function juraOwnerLines(
  prefix: string,
  fields: {
    name: string;
    nationality: string;
    nationalId: string;
    address: string;
    phone: string;
    email: string;
  }
): string {
  return `
    <p class="field-line"><span class="field-label">${escapeHtml(prefix)}أقـر انا :</span> <span class="field-value">${toHandoverHtml(fields.name)}</span></p>
    <p class="field-line"><span class="field-label">الجنسية :</span> <span class="field-value">${toHandoverHtml(fields.nationality)}</span></p>
    <p class="field-line"><span class="field-label">أحمل بطاقه رقم قومى / جواز سفر:</span> <span class="field-value">${formatLtrField(fields.nationalId)}</span></p>
    <p class="field-line"><span class="field-label">المقيم في :</span> <span class="field-value">${toHandoverHtml(fields.address)}</span></p>
    <p class="field-line"><span class="field-label">رقم التليفون :</span> <span class="field-value">${formatLtrField(fields.phone)}</span></p>
    <p class="field-line"><span class="field-label">البريد الالكتروني :</span> <span class="field-value">${formatLtrField(fields.email)}</span></p>`;
}

export function buildJuraOwnerBlock(
  fields: HandoverFieldValues,
  dual: boolean
): string {
  const owner1 = juraOwnerLines("1-", {
    name: fields.clientName,
    nationality: fields.nationality,
    nationalId: fields.nationalId,
    address: fields.address,
    phone: fields.phone1,
    email: fields.email,
  });

  if (!dual) return `<div class="owner-block">${owner1}</div>`;

  const owner2 = juraOwnerLines("2-", {
    name: fields.clientName2 ?? "—",
    nationality: fields.nationality2 ?? fields.nationality,
    nationalId: fields.nationalId2 ?? "—",
    address: fields.address2 ?? "—",
    phone: fields.phone1Owner2 ?? "—",
    email: fields.emailOwner2 ?? "—",
  });

  return `<div class="owner-block">${owner1}</div><div class="owner-block">${owner2}</div>`;
}
