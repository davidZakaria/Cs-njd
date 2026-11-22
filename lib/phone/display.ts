import { stripExcelNumericSuffix } from "@/lib/utils/arabic-normalize";

/** Display / export: strip Excel float suffix without changing stored digits. */
export function formatPhoneForDisplay(
  phone: string | null | undefined
): string {
  if (phone == null) return "";
  const trimmed = phone.trim();
  if (!trimmed) return "";
  return stripExcelNumericSuffix(trimmed);
}

/** Persist phones without Excel `.0` artifacts (idempotent). */
export function sanitizePhoneForStorage(
  phone: string | null | undefined
): string | null {
  if (phone == null) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  return stripExcelNumericSuffix(trimmed);
}