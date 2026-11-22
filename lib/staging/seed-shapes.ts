/** Production-like fake data shapes for staging seed (not real client data). */

export const MERGED_ARABIC_PAIRS = [
  ["محمد أحمد علي", "فاطمة حسن محمود"],
  ["عمر خالد إبراهيم", "نورا سعد عبد الله"],
  ["يوسف كمال رزق", "هدى عماد فؤاد"],
  ["أحمد ماهر جمال", "سلمى وائل عثمان"],
  ["كريم سامي ناصر", "ريم طارق شوقي"],
] as const;

export const SPELLING_VARIANT_NAMES = [
  { canonical: "نصر الله محمد", variant: "نصرالله محمد" },
  { canonical: "عبد الرحمن حسن", variant: "عبدالرحمن حسن" },
  { canonical: "صلاح الدين أحمد", variant: "صلاحالدين أحمد" },
] as const;

export const LEGACY_PHONE_ARTIFACTS = [
  { phone1: "96599034830.0", phone2: "0096551774292" },
  { phone1: "2011555010001.0", phone2: "00201012345678" },
  { phone1: "+2010987654321", phone2: "96512345678.0" },
] as const;

export function mergedSlashClientName(pairIndex: number): string {
  const [a, b] = MERGED_ARABIC_PAIRS[pairIndex % MERGED_ARABIC_PAIRS.length]!;
  return `${a} / ${b}`;
}

/** ~12% of units in production — mirror ratio in staging bulk. */
export function shouldUseMergedSlashOwnerShape(unitIndex: number): boolean {
  return unitIndex % 8 === 3;
}