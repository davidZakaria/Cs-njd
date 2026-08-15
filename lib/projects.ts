/** Canonical NJD project names — stored uppercase in the database. */
export const CANONICAL_PROJECTS = [
  "GREEN AVENUE",
  "JURA",
  "GENESIS",
  "SOUL PLAZA",
  "JAMILA NORTH COAST",
] as const;

export type CanonicalProject = (typeof CANONICAL_PROJECTS)[number];

/** Stable tab/id slug for routing and filters. */
export const PROJECT_SLUGS: Record<CanonicalProject, string> = {
  "GREEN AVENUE": "green-avenue",
  JURA: "jura",
  GENESIS: "genesis",
  "SOUL PLAZA": "soul-plaza",
  "JAMILA NORTH COAST": "jamila-north-coast",
};

export function isCanonicalProject(name: string): name is CanonicalProject {
  return (CANONICAL_PROJECTS as readonly string[]).includes(name);
}
