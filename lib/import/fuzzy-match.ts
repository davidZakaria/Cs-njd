/**
 * Normalizes Arabic/Excel text for fuzzy enum matching.
 * Strips diacritics, unifies alef/ya variants, and collapses whitespace.
 */
export function normalizeMatchText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\u0640\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ى]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/[^\w\u0600-\u06FF\s./+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

export type FuzzyCandidate<T extends string> = {
  value: T;
  /** Canonical Arabic/English labels and common Excel typos */
  patterns: string[];
};

export type FuzzyMatchResult<T extends string> = {
  value: T;
  score: number;
};

/**
 * Scores `raw` against ordered candidates (most specific patterns first).
 * Returns the best match above `minScore`, or null.
 */
export function fuzzyMatchEnum<T extends string>(
  raw: string | undefined | null,
  candidates: FuzzyCandidate<T>[],
  minScore = 0.62
): T | null {
  const normalized = normalizeMatchText(raw ?? "");
  if (!normalized) return null;

  let best: FuzzyMatchResult<T> | null = null;

  for (const candidate of candidates) {
    for (const pattern of candidate.patterns) {
      const normalizedPattern = normalizeMatchText(pattern);
      if (!normalizedPattern) continue;

      let score = 0;

      if (normalized === normalizedPattern) {
        score = 1;
      } else if (
        normalized.includes(normalizedPattern) ||
        normalizedPattern.includes(normalized)
      ) {
        const shorter = Math.min(normalized.length, normalizedPattern.length);
        const longer = Math.max(normalized.length, normalizedPattern.length);
        score = 0.85 + (shorter / longer) * 0.14;
      } else {
        const distance = levenshtein(normalized, normalizedPattern);
        const maxLen = Math.max(normalized.length, normalizedPattern.length);
        score = 1 - distance / maxLen;
      }

      if (!best || score > best.score) {
        best = { value: candidate.value, score };
      }
    }
  }

  if (!best || best.score < minScore) return null;
  return best.value;
}
