const NEEDS_REVIEW_MARKERS = [
  "بولايه",
  "بولاية",
  "ووالدها",
  "والدهم",
  "بصفته",
  "وكيل",
  "وكيلا",
  "guardian",
  "guardianship",
  "power of attorney",
  "poa",
] as const;

export type JointOwnerSplitResult =
  | { kind: "needsReview"; reason: string }
  | { kind: "split"; parts: string[]; separator: string }
  | { kind: "none" };

function containsNeedsReviewMarker(name: string): string | null {
  const lower = name.toLowerCase();
  for (const marker of NEEDS_REVIEW_MARKERS) {
    if (lower.includes(marker.toLowerCase())) return marker;
  }
  return null;
}

function splitByPattern(
  name: string,
  pattern: RegExp,
  separatorLabel: string
): JointOwnerSplitResult | null {
  const parts = name
    .split(pattern)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return { kind: "split", parts, separator: separatorLabel };
  }
  return null;
}

function tryTightHyphenBetweenFullNames(name: string): JointOwnerSplitResult | null {
  const match = name.match(/^(.+)-(.+)$/);
  if (!match) return null;
  const left = match[1].trim();
  const right = match[2].trim();
  if (!left || !right) return null;
  const leftWords = left.split(/\s+/).filter(Boolean);
  const rightWords = right.split(/\s+/).filter(Boolean);
  const leftIsFull = leftWords.length >= 2 || left.length >= 8;
  const rightIsFull = rightWords.length >= 2 || right.length >= 8;
  if (leftIsFull && rightIsFull) {
    return { kind: "split", parts: [left, right], separator: "-" };
  }
  return null;
}

export function analyzeJointOwnerName(name: string): JointOwnerSplitResult {
  const trimmed = name.trim();
  if (!trimmed) return { kind: "none" };

  const marker = containsNeedsReviewMarker(trimmed);
  if (marker) {
    return { kind: "needsReview", reason: marker };
  }

  const attempts: Array<() => JointOwnerSplitResult | null> = [
    () => splitByPattern(trimmed, /\s*\/\s*/, "/"),
    () => splitByPattern(trimmed, /\s*&\s*/, "&"),
    () => splitByPattern(trimmed, /\s+-\s+/, " - "),
    () => tryTightHyphenBetweenFullNames(trimmed),
  ];

  for (const attempt of attempts) {
    const result = attempt();
    if (result?.kind === "split") {
      const markerInPart = result.parts
        .map((p) => containsNeedsReviewMarker(p))
        .find(Boolean);
      if (markerInPart) {
        return { kind: "needsReview", reason: markerInPart };
      }
      return result;
    }
  }

  return { kind: "none" };
}
