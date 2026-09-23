import type { Role } from "@prisma/client";

export type CommunityActivityActionType =
  | "TICKET_OPENED"
  | "CALL_LOGGED"
  | "TIMELINE_NOTE"
  | "STATUS_CHANGE"
  | "CASE_RESOLVED";

export type CommunityTrackerViewerRole = Extract<
  Role,
  "COMMUNITY_MANAGEMENT" | "MANAGEMENT" | "SUPER_ADMIN"
>;

export function isCommunityTrackerTeamView(
  role: CommunityTrackerViewerRole
): boolean {
  return role === "MANAGEMENT" || role === "SUPER_ADMIN";
}
