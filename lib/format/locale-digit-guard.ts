import { LOCALE_IDENTIFIER_DATA_ATTR } from "@/lib/format/locale-display";

const WESTERN_DIGIT = /[0-9]/;
const IDENTIFIER_SELECTOR = `[${LOCALE_IDENTIFIER_DATA_ATTR}]`;

/** Collect text snippets containing Western digits outside identifier nodes (for tests). */
export function findWesternDigitsOutsideIdentifiers(root: ParentNode): string[] {
  const violations: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent) continue;
    if (parent.closest(IDENTIFIER_SELECTOR)) continue;
    const text = node.textContent ?? "";
    if (!WESTERN_DIGIT.test(text)) continue;
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 120);
    if (snippet) violations.push(snippet);
  }

  return violations;
}