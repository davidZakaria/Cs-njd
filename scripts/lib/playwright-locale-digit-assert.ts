import type { Locator } from "playwright";

import { LOCALE_IDENTIFIER_DATA_ATTR } from "@/lib/format/locale-display";

/** Fail Playwright checks when Western digits appear outside identifier nodes. */
export async function collectWesternDigitViolations(root: Locator): Promise<string[]> {
  return root.evaluate((element, attr) => {
    const WESTERN_DIGIT = /[0-9]/;
    const violations: string[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent) continue;
      if (parent.closest(`[${attr}]`)) continue;
      const text = node.textContent ?? "";
      if (!WESTERN_DIGIT.test(text)) continue;
      const snippet = text.replace(/\s+/g, " ").trim().slice(0, 120);
      if (snippet) violations.push(snippet);
    }

    return violations;
  }, LOCALE_IDENTIFIER_DATA_ATTR);
}

export async function assertNoWesternDigitsOutsideIdentifiers(
  root: Locator,
  label: string
): Promise<string[]> {
  const violations = await collectWesternDigitViolations(root);
  if (violations.length > 0) {
    return [`${label}: Western digits outside identifiers → ${violations.join(" | ")}`];
  }
  return [];
}