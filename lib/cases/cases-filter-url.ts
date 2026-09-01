import { PROJECT_SLUGS, type CanonicalProject } from "@/lib/projects";

export type CasesFilterParams = {
  status?: "open" | "PENDING" | "ENGINEERING" | "LEGAL" | "RESOLVED";
  project?: string;
  category?: string;
  agent?: string;
  followUp?: "due";
  pendingParty?: string;
};

export function buildCasesFilterUrl(params: CasesFilterParams): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.project) search.set("project", params.project);
  if (params.category) search.set("category", params.category);
  if (params.agent) search.set("agent", params.agent);
  if (params.followUp) search.set("followUp", params.followUp);
  if (params.pendingParty) search.set("pendingParty", params.pendingParty);
  const query = search.toString();
  return query ? `/cases?${query}` : "/cases";
}

export function slugToProjectName(slug: string): string | null {
  for (const [name, value] of Object.entries(PROJECT_SLUGS) as Array<
    [CanonicalProject, string]
  >) {
    if (value === slug) return name;
  }
  return null;
}

export function projectNameToSlug(name: string): string {
  if (name in PROJECT_SLUGS) {
    return PROJECT_SLUGS[name as CanonicalProject];
  }
  return name.toLowerCase().replace(/\s+/g, "-");
}

export type CasesPageFilters = {
  status: "all" | "open" | "PENDING" | "ENGINEERING" | "LEGAL" | "RESOLVED";
  project: string;
  category: string;
  agent: string;
  followUp: "all" | "due";
  pendingParty: string;
};

export function parseCasesPageFilters(
  searchParams: Record<string, string | string[] | undefined>
): CasesPageFilters {
  const rawStatus = String(searchParams.status ?? "all");
  const status =
    rawStatus === "open" ||
    rawStatus === "PENDING" ||
    rawStatus === "ENGINEERING" ||
    rawStatus === "LEGAL" ||
    rawStatus === "RESOLVED"
      ? rawStatus
      : "all";

  const rawFollowUp = String(searchParams.followUp ?? "all");

  return {
    status,
    project: String(searchParams.project ?? "all"),
    category: String(searchParams.category ?? "all"),
    agent: String(searchParams.agent ?? "all"),
    followUp: rawFollowUp === "due" ? "due" : "all",
    pendingParty: String(searchParams.pendingParty ?? "all"),
  };
}
