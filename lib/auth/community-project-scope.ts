import type { Prisma } from "@prisma/client";

import { COMMUNITY_MANAGED_CANONICAL_PROJECT } from "@/lib/projects/community-scope";
import { prisma } from "@/lib/prisma";

export type ProjectRef = { id: string; name: string };

export type { ProjectRef as CommunityProjectRef };

/** Match Jamila portfolio by configured id or project name hints. */
export function isCommunityManagedProject(project: ProjectRef): boolean {
  const configuredId = COMMUNITY_MANAGED_CANONICAL_PROJECT.id;
  if (configuredId && project.id === configuredId) {
    return true;
  }

  const name = project.name.trim();
  const upper = name.toUpperCase();
  if (upper.includes("JAMILA")) return true;
  if (name.includes("جميلة")) return true;
  if (upper === COMMUNITY_MANAGED_CANONICAL_PROJECT.name.toUpperCase()) {
    return true;
  }

  return false;
}

let cachedProjectIds: string[] | null = null;
let cacheExpiresAt = 0;

async function loadCommunityManagedProjectIds(): Promise<string[]> {
  const now = Date.now();
  if (cachedProjectIds && cacheExpiresAt > now) {
    return cachedProjectIds;
  }

  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
  });
  const ids = projects.filter(isCommunityManagedProject).map((p) => p.id);
  cachedProjectIds = ids;
  cacheExpiresAt = now + 60_000;
  return ids;
}

export async function communityManagedUnitWhere(): Promise<Prisma.UnitWhereInput> {
  const projectIds = await loadCommunityManagedProjectIds();
  if (projectIds.length === 0) {
    return { id: { in: [] } };
  }
  return { projectId: { in: projectIds } };
}

export function communityManagedUnitWhereSync(
  projectIds: string[]
): Prisma.UnitWhereInput {
  if (projectIds.length === 0) {
    return { id: { in: [] } };
  }
  return { projectId: { in: projectIds } };
}
