/** DHL tracking stays locked until the on-site visit is marked done. */

export const DHL_WORKFLOW_FIELD_NAMES = [
  "dhlSentToClient",
  "dhlSentToClientDate",
  "dhlReceivedFromClient",
  "dhlReceivedFromClientDate",
  "powerOfAttorneyReceived",
] as const;

export type DhlWorkflowFieldName = (typeof DHL_WORKFLOW_FIELD_NAMES)[number];

export type DhlWorkflowSnapshot = {
  siteVisitDone: boolean;
  dhlSentToClient: boolean;
  dhlSentToClientDate: Date | null;
  dhlReceivedFromClient: boolean;
  dhlReceivedFromClientDate: Date | null;
  powerOfAttorneyReceived: boolean;
};

export type DhlWorkflowPatch = Pick<
  DhlWorkflowSnapshot,
  | "dhlSentToClient"
  | "dhlSentToClientDate"
  | "dhlReceivedFromClient"
  | "dhlReceivedFromClientDate"
  | "powerOfAttorneyReceived"
> & {
  siteVisitDone?: boolean;
};

function dhlFieldsEqual(
  a: DhlWorkflowPatch,
  b: Pick<DhlWorkflowSnapshot, DhlWorkflowFieldName>
): boolean {
  return (
    a.dhlSentToClient === b.dhlSentToClient &&
    datesEqual(a.dhlSentToClientDate, b.dhlSentToClientDate) &&
    a.dhlReceivedFromClient === b.dhlReceivedFromClient &&
    datesEqual(a.dhlReceivedFromClientDate, b.dhlReceivedFromClientDate) &&
    a.powerOfAttorneyReceived === b.powerOfAttorneyReceived
  );
}

function datesEqual(a: Date | null | undefined, b: Date | null | undefined) {
  const aTime = a ? a.getTime() : null;
  const bTime = b ? b.getTime() : null;
  return aTime === bTime;
}

function emptyDhlFields(): Pick<
  DhlWorkflowSnapshot,
  DhlWorkflowFieldName
> {
  return {
    dhlSentToClient: false,
    dhlSentToClientDate: null,
    dhlReceivedFromClient: false,
    dhlReceivedFromClientDate: null,
    powerOfAttorneyReceived: false,
  };
}

function frozenDhlFromExisting(
  existing: DhlWorkflowSnapshot | null
): Pick<DhlWorkflowSnapshot, DhlWorkflowFieldName> {
  if (!existing) {
    return emptyDhlFields();
  }
  return {
    dhlSentToClient: existing.dhlSentToClient,
    dhlSentToClientDate: existing.dhlSentToClientDate,
    dhlReceivedFromClient: existing.dhlReceivedFromClient,
    dhlReceivedFromClientDate: existing.dhlReceivedFromClientDate,
    powerOfAttorneyReceived: existing.powerOfAttorneyReceived,
  };
}

function resolveSiteVisitDone(
  proposed: DhlWorkflowPatch,
  existing: DhlWorkflowSnapshot | null
): boolean {
  if (proposed.siteVisitDone !== undefined) {
    return proposed.siteVisitDone;
  }
  return existing?.siteVisitDone ?? false;
}

/**
 * When site visit is not done, DHL fields cannot change — values stay as stored
 * but the UI stays locked. Site visit done may be toggled off (persists false).
 */
export function applyDhlSiteVisitLock<T extends DhlWorkflowPatch>(
  proposed: T,
  existing: DhlWorkflowSnapshot | null
): T {
  const siteVisitDone = resolveSiteVisitDone(proposed, existing);

  if (siteVisitDone) {
    return { ...proposed, siteVisitDone: true };
  }

  const frozen = frozenDhlFromExisting(existing);

  if (
    existing &&
    dhlFieldsEqual(proposed, existing) &&
    proposed.siteVisitDone === false
  ) {
    return { ...proposed, siteVisitDone: false, ...frozen };
  }

  if (existing && dhlFieldsEqual(proposed, existing)) {
    return { ...proposed, siteVisitDone: false, ...frozen };
  }

  return {
    ...proposed,
    siteVisitDone: false,
    ...frozen,
  };
}

export function isDhlSectionActive(siteVisitDone: boolean): boolean {
  return siteVisitDone;
}
