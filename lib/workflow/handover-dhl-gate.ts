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

/**
 * When site visit is not done, DHL fields cannot change — proposed values are
 * replaced with the persisted snapshot (server-side enforcement).
 */
export function applyDhlSiteVisitLock<T extends DhlWorkflowPatch>(
  proposed: T,
  existing: DhlWorkflowSnapshot | null
): T {
  const siteVisitDone =
    proposed.siteVisitDone ?? existing?.siteVisitDone ?? false;

  if (siteVisitDone) {
    return proposed;
  }

  if (!existing) {
    return {
      ...proposed,
      dhlSentToClient: false,
      dhlSentToClientDate: null,
      dhlReceivedFromClient: false,
      dhlReceivedFromClientDate: null,
      powerOfAttorneyReceived: false,
    };
  }

  if (
    dhlFieldsEqual(proposed, existing) &&
    (proposed.siteVisitDone === undefined ||
      proposed.siteVisitDone === existing.siteVisitDone)
  ) {
    return proposed;
  }

  return {
    ...proposed,
    siteVisitDone: existing.siteVisitDone,
    dhlSentToClient: existing.dhlSentToClient,
    dhlSentToClientDate: existing.dhlSentToClientDate,
    dhlReceivedFromClient: existing.dhlReceivedFromClient,
    dhlReceivedFromClientDate: existing.dhlReceivedFromClientDate,
    powerOfAttorneyReceived: existing.powerOfAttorneyReceived,
  };
}

export function isDhlSectionActive(siteVisitDone: boolean): boolean {
  return siteVisitDone;
}
