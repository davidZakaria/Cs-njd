import { parse, isValid } from "date-fns";

const EXCEL_EPOCH = new Date(1899, 11, 30);

export function parseLegacyDate(value: unknown): Date | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && isValid(value)) return value;

  if (typeof value === "number" && !Number.isNaN(value)) {
    const date = new Date(EXCEL_EPOCH.getTime() + value * 86400000);
    return isValid(date) ? date : null;
  }

  const str = String(value).trim();
  if (!str) return null;

  const numeric = Number(str);
  if (!Number.isNaN(numeric) && /^\d+(\.\d+)?$/.test(str)) {
    const date = new Date(EXCEL_EPOCH.getTime() + numeric * 86400000);
    if (isValid(date)) return date;
  }

  const formats = ["yyyy-MM-dd", "d/M/yyyy", "dd/MM/yyyy", "M/d/yyyy", "d-M-yyyy"];
  for (const fmt of formats) {
    const parsed = parse(str, fmt, new Date());
    if (isValid(parsed)) return parsed;
  }

  const native = new Date(str);
  return isValid(native) ? native : null;
}
