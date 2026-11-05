import type { UnitRequestType } from "@prisma/client";

export type ApprovedUnitRequestOptionInput = {
  id: string;
  type: UnitRequestType;
  submittedAt: Date | null;
  updatedAt: Date;
  description: string | null;
};

const SUMMARY_MAX_LENGTH = 48;

export function summarizeUnitRequestDescription(description: string | null): string {
  if (!description) return "";
  const collapsed = description.replace(/\s+/g, " ").trim();
  if (!collapsed) return "";
  if (collapsed.length <= SUMMARY_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, SUMMARY_MAX_LENGTH - 1)}…`;
}

export function formatApprovedUnitRequestOptionLabel(input: {
  typeLabel: string;
  submittedAt: Date | null;
  updatedAt: Date;
  description: string | null;
  locale: string;
}): string {
  const referenceDate = input.submittedAt ?? input.updatedAt;
  const dateLabel = referenceDate.toLocaleDateString(input.locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const summary = summarizeUnitRequestDescription(input.description);
  return summary
    ? `${input.typeLabel} · ${dateLabel} · ${summary}`
    : `${input.typeLabel} · ${dateLabel}`;
}

export function filterApprovedRequestsForDocumentType<
  T extends { type: UnitRequestType },
>(approvedRequests: T[], requiredType: UnitRequestType | null): T[] {
  if (!requiredType) return approvedRequests;
  return approvedRequests.filter((request) => request.type === requiredType);
}

/** When set, callers should update linked request id; undefined means leave unchanged. */
export function resolveAutoLinkedUnitRequestId(input: {
  needsRequest: boolean;
  requestOptions: Array<{ id: string }>;
  unitRequestId: string;
}): string | undefined {
  if (!input.needsRequest) return undefined;
  if (input.requestOptions.length === 1) {
    const onlyId = input.requestOptions[0]!.id;
    return input.unitRequestId === onlyId ? undefined : onlyId;
  }
  if (input.requestOptions.length === 0) {
    return input.unitRequestId ? "" : undefined;
  }
  if (
    input.unitRequestId &&
    !input.requestOptions.some((option) => option.id === input.unitRequestId)
  ) {
    return "";
  }
  return undefined;
}

export function canEditOfficialDocumentDraftNow(input: {
  needsRequest: boolean;
  unitRequestId: string;
}): boolean {
  return !input.needsRequest || Boolean(input.unitRequestId);
}

export function buildPrefilledCreateUnitRequestHref(input: {
  unitId: string;
  requestType: UnitRequestType;
}): string {
  const params = new URLSearchParams();
  params.set("unitId", input.unitId);
  params.set("type", input.requestType);
  return `/requests?${params.toString()}`;
}
