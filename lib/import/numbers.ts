export function parseLegacyNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;

  let str = String(value).trim();
  if (!str) return null;

  str = str
    .replace(/[جEGPLE$€£]/gi, "")
    .replace(/,/g, "")
    .replace(/[^\d.\u0660-\u0669\u06F0-\u06F9]/g, " ")
    .trim();

  const thousandMatch = str.match(/([\d.]+)\s*(?:ال?ف|أ?لف|الف)/i);
  if (thousandMatch) {
    return Math.round(parseFloat(thousandMatch[1]) * 1000);
  }

  const cleaned = str.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}
