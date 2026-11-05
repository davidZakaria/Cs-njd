import type { WorkScopeMode } from "@/lib/work/personal-scope";

export type WorkScopeQuery = "mine" | "all";

export function parseWorkScopeFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): WorkScopeMode {
  const raw = String(searchParams.tasks ?? "mine");
  return raw === "all" ? "oversight" : "personal";
}

export function workScopeToQueryParam(mode: WorkScopeMode): WorkScopeQuery {
  return mode === "oversight" ? "all" : "mine";
}

export function mergeWorkScopeIntoSearchParams(
  searchParams: URLSearchParams,
  mode: WorkScopeMode
): URLSearchParams {
  const next = new URLSearchParams(searchParams.toString());
  if (mode === "oversight") {
    next.set("tasks", "all");
  } else {
    next.delete("tasks");
  }
  return next;
}
