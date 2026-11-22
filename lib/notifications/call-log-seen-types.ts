import type { Role } from "@prisma/client";

export type CallLogSeenKind = "seen" | "not_seen" | "no_agent";

export type CallLogSeenInfo = {
  kind: CallLogSeenKind;
  agentName: string | null;
  readAt: string | null;
};

export function roleShowsCallLogSeenStatus(role: Role | string): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "MANAGEMENT" ||
    role === "COMMUNITY_MANAGEMENT"
  );
}