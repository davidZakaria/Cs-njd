import type { Role } from "@prisma/client";

export type StaffMember = {
  name: string;
  email: string;
  role: Role;
  legacyNames: readonly string[];
};

/** Canonical staff roster — single source of truth for sync + import resolution. */
export const STAFF_ROSTER: readonly StaffMember[] = [
  {
    name: "Islam Tharwat",
    email: "islam.tharwat@newjerseyegypt.com",
    role: "CS_AGENT",
    legacyNames: ["اسلام ثروت", "اسلام", "Islam", "Islam Tharwat"],
  },
  {
    name: "Maria Emad",
    email: "maria.emad@newjerseyegypt.com",
    role: "CS_AGENT",
    legacyNames: ["ماريا عماد", "ماريا", "Maria Emad", "Maria"],
  },
  {
    name: "Mariam Nabih",
    email: "mariam.nabih@newjerseyegypt.com",
    role: "CS_AGENT",
    legacyNames: ["مريم نبيه", "مريم", "Mariam Nabih"],
  },
  {
    name: "Dina Girgis",
    email: "dina.gerges@newjerseyegypt.com",
    role: "CS_AGENT",
    legacyNames: ["دينا جرجس", "دينا", "Dina Girgis"],
  },
  {
    name: "Madonna Hanna",
    email: "madonna.hanna@newjerseyegypt.com",
    role: "MANAGEMENT",
    legacyNames: [
      "ا/ مــــــادونا حنا",
      "ا/مادونا حنا",
      "ا/ مادونا حنا",
      "Madonna Hanna",
      "مصطفي موسي",
      "Mostafa Mousa",
      "احمد الزاهد",
      "Ahmed Zahed",
    ],
  },
  {
    name: "Reda Youssef",
    email: "reda.youssef@newjerseyegypt.com",
    role: "MANAGEMENT",
    legacyNames: [
      "Reda Youssef",
      "رضا يوسف",
      "مهندس رضا",
      "م/ رضا",
      "م. رضا",
      "Eng Reda",
    ],
  },
] as const;

export const STAFF_DEFAULT_PASSWORD = "ChangeMe123!";

export const STAFF_EMAILS = STAFF_ROSTER.map((person) => person.email);

export function getCsAgentEmails(): string[] {
  return STAFF_ROSTER.filter((person) => person.role === "CS_AGENT").map(
    (person) => person.email
  );
}

/** CS agents + management — anyone who can appear on a case assignment. */
export function getAssignableAgentEmails(): string[] {
  return STAFF_ROSTER.filter(
    (person) => person.role === "CS_AGENT" || person.role === "MANAGEMENT"
  ).map((person) => person.email);
}

/** Maps normalized Excel agent labels to canonical staff emails. */
export function buildStaffAliasMap(): Map<string, string> {
  const map = new Map<string, string>();

  for (const person of STAFF_ROSTER) {
    map.set(normalizeAgentKey(person.name), person.email);
    map.set(normalizeAgentKey(person.email), person.email);
    for (const alias of person.legacyNames) {
      map.set(normalizeAgentKey(alias), person.email);
    }
  }

  return map;
}

export function normalizeAgentKey(value: string): string {
  return value
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\u0640/g, "")
    .replace(/^ا\/\s*/u, "")
    .replace(/\s+/g, " ");
}
