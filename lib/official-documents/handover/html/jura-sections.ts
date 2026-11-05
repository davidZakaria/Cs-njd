import type { HandoverFieldValues } from "@/lib/print/handover-templates/types";

import { escapeHtml, formatLtrField, toHandoverHtml } from "./utils";

/**
 * Split Jura section template text into a short title line and body paragraph.
 */
export function splitJuraSectionHeadingBody(text: string): {
  heading: string;
  body: string;
} {
  const t = text.trim();

  const sec2 = t.match(/^(ثانيا\s*:\s*.+?\))\s*(.+)$/u);
  if (sec2) {
    return { heading: sec2[1]!.trim(), body: sec2[2]!.trim() };
  }

  const sec5 = t.match(/^(خامسا\s*:\s*.+?)(?=\d+\.\s*)/u);
  if (sec5) {
    return {
      heading: sec5[1]!.trim(),
      body: t.slice(sec5[1]!.length).trim(),
    };
  }

  const sec7 = t.match(/^(سابعا\s*:\s*.+?\))\s*(.+)$/u);
  if (sec7) {
    return { heading: sec7[1]!.trim(), body: sec7[2]!.trim() };
  }

  const sec10 = t.match(
    /^(عاشر[أاً]+\s*:\s*الإخلاء الإداري وإنهاء الإقامة)([\s\S]*)$/u
  );
  if (sec10) {
    return { heading: sec10[1]!.trim(), body: sec10[2]!.trim() };
  }

  const stuckAqr = t.match(/^(.+?:\s*.+?)(?<=[^\s])أقر([\s\S]*)$/u);
  if (stuckAqr) {
    return {
      heading: stuckAqr[1]!.trim(),
      body: (`أقر${stuckAqr[2]}`).trim(),
    };
  }

  const spacedAqr = t.match(/^(.+?)\s+(?:و\s*)?أقر\s([\s\S]*)$/u);
  if (spacedAqr && spacedAqr[1]!.includes(":")) {
    return {
      heading: spacedAqr[1]!.trim(),
      body: `أقر ${spacedAqr[2]!.trim()}`,
    };
  }

  const colon = t.indexOf(":");
  if (colon > 0) {
    return {
      heading: t.slice(0, colon + 1).trim(),
      body: t.slice(colon + 1).trim(),
    };
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
