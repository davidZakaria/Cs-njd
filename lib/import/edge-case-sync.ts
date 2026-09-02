import { normalizeMatchText } from "@/lib/import/fuzzy-match";

export type EdgeCaseDerivation = {
  isLegallyBlocked?: boolean;
  powerOfAttorneyReceived?: boolean;
  customModifications?: string | null;
  modificationsCompleted?: boolean;
};

const LEGAL_BLOCK_KEYWORDS = [
  "قضي",
  "قضية",
  "محكم",
  "حماية المستهلك",
  "بلوك",
];

const MODIFICATION_KEYWORDS = ["حائط", "تعديل", "يشيل", "إلغاء"];

const POA_PENDING_KEYWORDS = ["توكيل", "dhl"];

function splitSentences(text: string): string[] {
  return text
    .split(/[\n\r.،؛!?]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractModificationSentence(text: string): string | null {
  for (const sentence of splitSentences(text)) {
    const normalized = normalizeMatchText(sentence);
    if (
      MODIFICATION_KEYWORDS.some((keyword) =>
        normalized.includes(normalizeMatchText(keyword))
      )
    ) {
      return sentence.trim();
    }
  }
  return null;
}

export function deriveEdgeCasesFromLegacyText(notes: string): EdgeCaseDerivation {
  const normalized = normalizeMatchText(notes ?? "");
  if (!normalized) return {};

  const result: EdgeCaseDerivation = {};

  if (
    LEGAL_BLOCK_KEYWORDS.some((keyword) =>
      normalized.includes(normalizeMatchText(keyword))
    )
  ) {
    result.isLegallyBlocked = true;
  }

  const modificationSentence = extractModificationSentence(notes);
  if (modificationSentence) {
    result.customModifications = modificationSentence;
    result.modificationsCompleted = false;
  }

  if (
    POA_PENDING_KEYWORDS.some((keyword) =>
      normalized.includes(normalizeMatchText(keyword))
    )
  ) {
    result.powerOfAttorneyReceived = false;
  }

  return result;
}
