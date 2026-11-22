export const CALL_LOG_DEDUPE_PREFIX = "call-log:";

export function callLogDedupeKey(ticketId: string): string {
  return `${CALL_LOG_DEDUPE_PREFIX}${ticketId}`;
}

export function parseCallLogTicketId(dedupeKey: string | null | undefined): string | null {
  if (!dedupeKey?.startsWith(CALL_LOG_DEDUPE_PREFIX)) return null;
  const ticketId = dedupeKey.slice(CALL_LOG_DEDUPE_PREFIX.length);
  return ticketId.length > 0 ? ticketId : null;
}