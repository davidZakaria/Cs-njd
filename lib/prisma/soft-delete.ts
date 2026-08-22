import type { Prisma } from "@prisma/client";

/** Models that support soft delete via `deletedAt`. */
export const SOFT_DELETE_MODELS = [
  "User",
  "Client",
  "Unit",
  "Ticket",
  "Finishing",
  "ContractWorkflow",
] as const;

export type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];

export const notDeleted = { deletedAt: null } as const;

export function isSoftDeleteModel(model: string): model is SoftDeleteModel {
  return (SOFT_DELETE_MODELS as readonly string[]).includes(model);
}

export function mergeNotDeleted<T extends Record<string, unknown>>(
  where?: T
): T & { deletedAt: null } {
  return { ...(where ?? ({} as T)), deletedAt: null };
}

function withActiveUnit(
  unit?: Prisma.UnitWhereInput | Prisma.UnitScalarRelationFilter
): Prisma.UnitWhereInput {
  return {
    ...(unit as Prisma.UnitWhereInput),
    deletedAt: null,
  };
}

/** Filter tickets and their parent units (dashboards / tables). */
export function activeTicketWhere(
  where: Prisma.TicketWhereInput
): Prisma.TicketWhereInput {
  if (where.OR) {
    return {
      ...where,
      deletedAt: null,
      unit: { deletedAt: null },
      OR: where.OR.map((clause) => {
        if (!clause || typeof clause !== "object" || !("unit" in clause)) {
          return clause;
        }
        return {
          ...clause,
          unit: withActiveUnit(clause.unit as Prisma.UnitWhereInput),
        };
      }),
    };
  }

  return {
    ...where,
    deletedAt: null,
    unit: withActiveUnit(where.unit as Prisma.UnitWhereInput | undefined),
  };
}

/** Filter units in list views. */
export function activeUnitWhere(
  where: Prisma.UnitWhereInput = {}
): Prisma.UnitWhereInput {
  return { ...where, deletedAt: null };
}

/** Filter contract workflow rows with live units only. */
export function activeContractWorkflowWhere(
  where: Prisma.ContractWorkflowWhereInput
): Prisma.ContractWorkflowWhereInput {
  return {
    ...where,
    deletedAt: null,
    unit: withActiveUnit(where.unit as Prisma.UnitWhereInput | undefined),
  };
}

export function archivedUserEmail(userId: string) {
  return `deleted-${userId}@archived.njd.local`;
}
