import { CANONICAL_PROJECTS } from "@/lib/projects";

/**
 * Community Management operates only on the Jamila project.
 * Override `COMMUNITY_MANAGED_PROJECT_ID` in the environment when needed.
 */
export const COMMUNITY_MANAGED_CANONICAL_PROJECT = {
  name: "JAMILA NORTH COAST" as (typeof CANONICAL_PROJECTS)[number],
  id: process.env.COMMUNITY_MANAGED_PROJECT_ID?.trim() || null,
};
