import type { HandoverStatus } from "@prisma/client";

export const DELIVERED_HANDOVER_STATUSES: readonly HandoverStatus[] = [
  "DELIVERY_PROTOCOL",
  "DELIVERED",
];

export const AT_RISK_HANDOVER_STATUSES: readonly HandoverStatus[] = [
  "REFUSED_DELIVERY",
  "REFUSED_EXTENSION",
  "INSTALLMENT_STOP_WARNING",
  "DELIVERY_WARNING",
  "LEGAL_DISPUTE",
  "CANCELLED",
];

/** Subset used by legacy units list “legal dispute” filter (excludes cancelled). */
export const LEGAL_DISPUTE_HANDOVER_STATUSES: readonly HandoverStatus[] =
  AT_RISK_HANDOVER_STATUSES.filter((s) => s !== "CANCELLED");

export function isDeliveredHandover(
  status: HandoverStatus | string | null | undefined
): boolean {
  return (
    status != null &&
    (DELIVERED_HANDOVER_STATUSES as readonly string[]).includes(status)
  );
}

export function isAtRiskHandover(
  status: HandoverStatus | string | null | undefined
): boolean {
  return (
    status != null &&
    (AT_RISK_HANDOVER_STATUSES as readonly string[]).includes(status)
  );
}
