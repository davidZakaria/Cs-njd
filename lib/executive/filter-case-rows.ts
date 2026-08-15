import type { ExecutiveCaseRow } from "@/lib/cases/executive-dashboard";
import { isAwaitingResponseNote } from "@/lib/import/master-cases";

export type ExecutiveCaseSearchContext = {
  projectLabel: (project: string) => string;
  ticketStatus: (status: string) => string;
  ticketCategory: (category: string) => string;
  staffName: (name: string) => string;
  awaitingResponseLabel: string;
};

function rowSearchText(
  row: ExecutiveCaseRow,
  context: ExecutiveCaseSearchContext
): string {
  const notes = isAwaitingResponseNote(row.notes)
    ? context.awaitingResponseLabel
    : row.notes;

  return [
    row.client,
    row.unitCode,
    row.project,
    context.projectLabel(row.project),
    notes,
    row.status,
    context.ticketStatus(row.status),
    row.category,
    context.ticketCategory(row.category),
    row.agentName,
    context.staffName(row.agentName),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterExecutiveCaseRows(
  rows: ExecutiveCaseRow[],
  query: string,
  context: ExecutiveCaseSearchContext
): ExecutiveCaseRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((row) => rowSearchText(row, context).includes(q));
}
