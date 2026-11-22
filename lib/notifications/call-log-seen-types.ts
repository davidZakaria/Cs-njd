export type CallLogSeenKind = "seen" | "not_seen" | "no_agent";

export type CallLogSeenInfo = {
  kind: CallLogSeenKind;
  agentName: string | null;
  readAt: string | null;
};