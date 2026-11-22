import type { HandoverStatus, Prisma } from "@prisma/client";
import { activeUnitWhere } from "@/lib/prisma";
import { OVERDUE_DELIVERY_EXCLUDED_STATUSES } from "@/lib/executive/handover-status-groups";
import {
  handoverStatusesForGroup,
  type UnitsPageFilters,
} from "@/lib/units/units-filter-url";
import { startOfDay } from "@/lib/units/unit-dashboard-filters";

function handoverStatusIn(
  statuses: readonly HandoverStatus[]
): Prisma.ContractWorkflowWhereInput {
  return {
    deletedAt: null,
    handoverStatus: { in: [...statuses] },
  };
}

/** Prisma `unit.count` where clauses aligned with units list filters. */
export function unitWhereForDashboardFilters(
  filters: UnitsPageFilters,
  options?: {
    unitScope?: Prisma.UnitWhereInput;
    todayStart?: Date;
  }
): Prisma.UnitWhereInput {
  const todayStart = options?.todayStart ?? startOfDay(new Date());
  const scope = options?.unitScope ?? {};
  let where: Prisma.UnitWhereInput = activeUnitWhere(scope);

  if (filters.agent === "unassigned") {
    where = { ...where, agentId: null };
  }

  const handoverStatuses = handoverStatusesForGroup(filters.handover);
  if (handoverStatuses) {
    where = {
      ...where,
      contractWorkflow: handoverStatusIn(handoverStatuses as HandoverStatus[]),
    };
  }

  if (filters.delivery === "overdue") {
    where = {
      ...where,
      contractWorkflow: {
        deletedAt: null,
        deliveryDate: { lt: todayStart },
        handoverStatus: { notIn: [...OVERDUE_DELIVERY_EXCLUDED_STATUSES] },
      },
    };
  }

  if (filters.fees === "outstanding") {
    where = {
      ...where,
      contractWorkflow: {
        deletedAt: null,
        hasPaidFees: false,
      },
      finishing: {
        OR: [{ doorFees: { gt: 0 } }, { aluminumFees: { gt: 0 } }],
      },
    };
  }

  if (filters.signedProtocol === "missing") {
    where = {
      ...where,
      OR: [
        // No active workflow (none at all, or only soft-deleted) — same as units list include.
        { NOT: { contractWorkflow: { deletedAt: null } } },
        {
          contractWorkflow: {
            deletedAt: null,
            signedProtocolStoredName: null,
          },
        },
      ],
    };
  }

  return where;
}