import { CANONICAL_PROJECTS } from "@/lib/projects";
import { normalizeProjectName } from "@/lib/import/sanitize";

/** Map spreadsheet project labels to canonical DB project names. */
export function resolveImportProjectName(raw: string): string {
  const normalized = normalizeProjectName(raw);
  if (!normalized) return normalized;

  if (normalized === "JAMILA" || normalized.includes("JAMILA")) {
    return "JAMILA NORTH COAST";
  }
  if (normalized.includes("GREEN") && normalized.includes("AVENUE")) {
    return "GREEN AVENUE";
  }
  if (normalized === "GENESIS") return "GENESIS";
  if (normalized === "JURA") return "JURA";
  if (normalized.includes("SOUL") && normalized.includes("PLAZA")) {
    return "SOUL PLAZA";
  }

  if ((CANONICAL_PROJECTS as readonly string[]).includes(normalized)) {
    return normalized;
  }

  return normalized;
}
