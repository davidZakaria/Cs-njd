import { formatDateTime } from "@/lib/format/datetime";

export type UnitSwapHistoryInput = {
  locale: string;
  tOutgoing: (key: string, values: Record<string, string>) => string;
  tIncoming: (key: string, values: Record<string, string>) => string;
  unit: {
    swapHistoryNote: string | null;
    swapOutgoingUnitCode: string | null;
    swapOutgoingProjectName: string | null;
    swapOutgoingAt: Date | null;
    swapOutgoingByName: string | null;
    swapOutgoingClientName: string | null;
    swappedFromUnitCode: string | null;
    swappedFromProjectName: string | null;
    swappedFromAt: Date | null;
    swappedFromByName: string | null;
    swappedFromUnitId: string | null;
    swapOutgoingUnitId: string | null;
  };
};

function formatSwapMoment(
  locale: string,
  at: Date | null | undefined
): string {
  if (!at) return "";
  return formatDateTime(at, locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Render localized swap history for the unit profile banner. */
export function formatUnitSwapHistoryMessage(input: UnitSwapHistoryInput): string | null {
  const { unit, locale, tOutgoing, tIncoming } = input;

  if (
    unit.swapOutgoingUnitId &&
    unit.swapOutgoingUnitCode &&
    unit.swapOutgoingAt
  ) {
    return tOutgoing("outgoingMessage", {
      clientName: unit.swapOutgoingClientName ?? "—",
      unitCode: unit.swapOutgoingUnitCode,
      project: unit.swapOutgoingProjectName ?? "—",
      date: formatSwapMoment(locale, unit.swapOutgoingAt),
      user: unit.swapOutgoingByName ?? "—",
    });
  }

  if (unit.swappedFromUnitId && unit.swappedFromUnitCode && unit.swappedFromAt) {
    return tIncoming("incomingMessage", {
      unitCode: unit.swappedFromUnitCode,
      project: unit.swappedFromProjectName ?? "—",
      date: formatSwapMoment(locale, unit.swappedFromAt),
      user: unit.swappedFromByName ?? "—",
    });
  }

  return unit.swapHistoryNote;
}
