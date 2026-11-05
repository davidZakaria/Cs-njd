import type {
  GreenAvenueTemplate,
  HandoverTemplateContent,
  HandoverTemplateKey,
  JuraTemplate,
} from "@/lib/print/handover-templates/types";

import { loadHandoverTemplate } from "@/lib/print/handover-templates/resolve";

export function splitHandoverDraftChunks(draftBody: string): string[] {
  return draftBody
    .split(/\n\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

export function greenAvenueBodyChunksWithoutHeader(chunks: string[]): string[] {
  if (chunks.length === 0) return [];
  const first = chunks[0] ?? "";
  if (
    first.includes("محض") ||
    first.includes("Green") ||
    first.includes("جرين") ||
    first.includes("جورا")
  ) {
    return chunks.slice(1);
  }
  return chunks;
}

/** Test-only ASCII markers and short appended legal notes must stay with preceding body text. */
export function isHandoverDraftAppendixChunk(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 160) return false;
  if (/^LEGAL_E2E_/i.test(trimmed)) return true;
  if (/^[\x20-\x7E\u200e\u200f]+$/.test(trimmed) && !/[أ-ي]/u.test(trimmed)) {
    return true;
  }
  return false;
}

export function mergeTrailingHandoverAppendixChunks(chunks: string[]): string[] {
  const merged = [...chunks];
  while (merged.length >= 2 && isHandoverDraftAppendixChunk(merged[merged.length - 1]!)) {
    const appendix = merged.pop()!;
    const body = merged.pop()!;
    merged.push(`${body}\n\n${appendix}`);
  }
  return merged;
}

/** Required section markers — reject generate when absent (no silent template fill-in). */
export function validateOfficialHandoverDraftStructure(input: {
  templateKey: HandoverTemplateKey;
  draftBody: string;
}): { ok: true } | { ok: false; error: string } {
  const template = loadHandoverTemplate(input.templateKey);
  const chunks = greenAvenueBodyChunksWithoutHeader(
    splitHandoverDraftChunks(input.draftBody.trim())
  );
  const joined = chunks.join("\n\n");

  if (template.kind === "green-avenue") {
    return validateGreenStructure(template, joined, chunks);
  }
  return validateJuraStructure(template, joined, chunks);
}

function validateGreenStructure(
  template: GreenAvenueTemplate,
  joined: string,
  chunks: string[]
): { ok: true } | { ok: false; error: string } {
  if (!/أولاً|اولا/u.test(joined)) {
    return { ok: false, error: "Handover draft is missing section (أولاً: recipient data)." };
  }
  if (!/ثان/u.test(joined)) {
    return { ok: false, error: "Handover draft is missing section (ثانياً: unit data)." };
  }
  if (!/إقرار/u.test(joined)) {
    return { ok: false, error: "Handover draft is missing declaration (إقرار)." };
  }
  const introNeedle = template.violationsIntro.slice(0, Math.min(12, template.violationsIntro.length));
  if (introNeedle && !joined.includes(introNeedle) && !/مخالف/u.test(joined)) {
    return {
      ok: false,
      error: "Handover draft is missing violations / undertakings section.",
    };
  }
  if (template.insurance) {
    const hasInsuranceChunk = chunks.some((c) => /تأمين|التشطيبات/u.test(c));
    if (!hasInsuranceChunk) {
      return {
        ok: false,
        error:
          "Handover draft is missing insurance / finishing deposit section for this variant.",
      };
    }
  }
  return { ok: true };
}

function validateJuraStructure(
  template: JuraTemplate,
  joined: string,
  _chunks: string[]
): { ok: true } | { ok: false; error: string } {
  void template;
  if (!/أولاً|1-/u.test(joined)) {
    return { ok: false, error: "Jura handover draft is missing first section (أولاً)." };
  }
  if (!/ثان/u.test(joined)) {
    return { ok: false, error: "Jura handover draft is missing section (ثانياً)." };
  }
  if (!/ثالث/u.test(joined)) {
    return { ok: false, error: "Jura handover draft is missing section (ثالثاً)." };
  }
  return { ok: true };
}

export function templateForKey(key: HandoverTemplateKey): HandoverTemplateContent {
  return loadHandoverTemplate(key);
}
