export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeProjectName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

export function normalizeUnitCode(code: string | number): string {
  const str = String(code).trim();
  if (/^\d+\.0$/.test(str)) return str.replace(/\.0$/, "");
  return str;
}

export function splitPhones(raw?: string): { phone1?: string; phone2?: string } {
  if (!raw) return {};
  const parts = raw
    .split(/[-/]/)
    .map((p) => p.replace(/\s+/g, "").trim())
    .filter(Boolean);
  return { phone1: parts[0], phone2: parts[1] };
}

export function stripNumericSuffix(value: string): string {
  return value.replace(/\.0$/, "");
}
