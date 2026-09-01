import { prisma } from "@/lib/prisma";
import {
  activeContractWorkflowWhere,
  activeTicketWhere,
  activeUnitWhere,
} from "@/lib/prisma";
import {
  ENGINEERING_FINISHING_PHASES,
  isFinishingWorkComplete,
  normalizeFinishingPhases,
} from "@/lib/finishing/phases";
import type { FinishingPhase, HandoverStatus } from "@prisma/client";

export type HandoverPipelineBucket =
  | "pending"
  | "inProgress"
  | "delivered"
  | "atRisk";

export type HandoverPipelineSlice = {
  key: HandoverPipelineBucket;
  count: number;
};

export type FinishingPhaseSlice = {
  phase: FinishingPhase;
  count: number;
};

export type SignedProtocolSlice = {
  key: "uploaded" | "missing";
  count: number;
};

export type ExecutivePortfolioMetrics = {
  totalUnits: number;
  deliveredUnits: number;
  legalRiskUnits: number;
  pendingHandoverUnits: number;
  deliveryOverdue: number;
  deliveryDueThisMonth: number;
  followUpDueToday: number;
  followUpOverdue: number;
  feesOutstanding: number;
  finishingInProgress: number;
  finishingComplete: number;
  handoverPipeline: HandoverPipelineSlice[];
  finishingPhases: FinishingPhaseSlice[];
  signedProtocol: SignedProtocolSlice[];
};

const IN_PROGRESS_HANDOVER: HandoverStatus[] = [
  "DELIVERY_EXTENSION",
  "FINISHING_CHANGE",
  "UNIT_SWAP",
  "NEW_CONTRACT",
  "WAIVER",
  "EXTENSION",
];

const DELIVERED_HANDOVER: HandoverStatus[] = ["DELIVERY_PROTOCOL", "DELIVERED"];

const AT_RISK_HANDOVER: HandoverStatus[] = [
  "REFUSED_DELIVERY",
  "REFUSED_EXTENSION",
  "INSTALLMENT_STOP_WARNING",
  "DELIVERY_WARNING",
  "LEGAL_DISPUTE",
  "CANCELLED",
];

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function classifyHandover(
  status: HandoverStatus | null | undefined
): HandoverPipelineBucket {
  if (!status || status === "PENDING") return "pending";
  if (DELIVERED_HANDOVER.includes(status)) return "delivered";
  if (AT_RISK_HANDOVER.includes(status)) return "atRisk";
  if (IN_PROGRESS_HANDOVER.includes(status)) return "inProgress";
  return "inProgress";
}

function currentFinishingPhase(
  phases: FinishingPhase[] | null | undefined,
  legacyPhase: FinishingPhase | null | undefined
): FinishingPhase {
  const normalized = normalizeFinishingPhases(
    phases?.length ? phases : legacyPhase ? [legacyPhase] : ["NOT_STARTED"]
  );
  if (isFinishingWorkComplete(normalized)) return "FINAL_PAINT";
  return normalized.at(-1) ?? "NOT_STARTED";
}

export async function getExecutivePortfolioMetrics(): Promise<ExecutivePortfolioMetrics> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  const [
    totalUnits,
    deliveredUnits,
    legalRiskUnits,
    pendingHandoverUnits,
    deliveryOverdue,
    deliveryDueThisMonth,
    followUpDueToday,
    followUpOverdue,
    feesOutstanding,
    unitsWithFinishing,
    workflows,
    signedUploadedResolved,
    signedMissingResolved,
  ] = await Promise.all([
    prisma.unit.count({ where: activeUnitWhere() }),
    prisma.contractWorkflow.count({
      where: activeContractWorkflowWhere({
        handoverStatus: { in: DELIVERED_HANDOVER },
      }),
    }),
    prisma.contractWorkflow.count({
      where: activeContractWorkflowWhere({
        handoverStatus: { in: AT_RISK_HANDOVER },
      }),
    }),
    prisma.contractWorkflow.count({
      where: activeContractWorkflowWhere({ handoverStatus: "PENDING" }),
    }),
    prisma.contractWorkflow.count({
      where: activeContractWorkflowWhere({
        deliveryDate: { lt: todayStart },
        handoverStatus: { notIn: DELIVERED_HANDOVER },
      }),
    }),
    prisma.contractWorkflow.count({
      where: activeContractWorkflowWhere({
        deliveryDate: { gte: todayStart, lte: monthEnd },
        handoverStatus: { notIn: DELIVERED_HANDOVER },
      }),
    }),
    prisma.ticket.count({
      where: activeTicketWhere({
        status: { in: ["PENDING", "ENGINEERING", "LEGAL"] },
        nextFollowUpDate: { gte: todayStart, lte: todayEnd },
      }),
    }),
    prisma.ticket.count({
      where: activeTicketWhere({
        status: { in: ["PENDING", "ENGINEERING", "LEGAL"] },
        nextFollowUpDate: { lt: todayStart },
      }),
    }),
    prisma.contractWorkflow.count({
      where: activeContractWorkflowWhere({
        hasPaidFees: false,
        unit: {
          finishing: {
            OR: [{ doorFees: { gt: 0 } }, { aluminumFees: { gt: 0 } }],
          },
        },
      }),
    }),
    prisma.finishing.findMany({
      where: { deletedAt: null, unit: activeUnitWhere() },
      select: { phases: true, phase: true },
    }),
    prisma.contractWorkflow.findMany({
      where: activeContractWorkflowWhere({}),
      select: { handoverStatus: true },
    }),
    prisma.unit.count({
      where: activeUnitWhere({
        tickets: { some: activeTicketWhere({ status: "RESOLVED" }) },
        contractWorkflow: {
          deletedAt: null,
          signedProtocolStoredName: { not: null },
        },
      }),
    }),
    prisma.unit.count({
      where: activeUnitWhere({
        tickets: { some: activeTicketWhere({ status: "RESOLVED" }) },
        OR: [
          { contractWorkflow: null },
          {
            contractWorkflow: {
              deletedAt: null,
              signedProtocolStoredName: null,
            },
          },
        ],
      }),
    }),
  ]);

  const handoverCounts: Record<HandoverPipelineBucket, number> = {
    pending: 0,
    inProgress: 0,
    delivered: 0,
    atRisk: 0,
  };

  for (const row of workflows) {
    handoverCounts[classifyHandover(row.handoverStatus)] += 1;
  }

  const unitsWithoutWorkflow = Math.max(0, totalUnits - workflows.length);
  handoverCounts.pending += unitsWithoutWorkflow;

  const phaseCounts = new Map<FinishingPhase, number>();
  let finishingComplete = 0;
  let finishingInProgress = 0;

  for (const row of unitsWithFinishing) {
    const normalized = normalizeFinishingPhases(
      row.phases.length ? row.phases : row.phase ? [row.phase] : []
    );
    const phase = currentFinishingPhase(row.phases, row.phase);
    phaseCounts.set(phase, (phaseCounts.get(phase) ?? 0) + 1);
    if (isFinishingWorkComplete(normalized)) {
      finishingComplete += 1;
    } else if (phase !== "NOT_STARTED") {
      finishingInProgress += 1;
    }
  }

  const finishingPhases: FinishingPhaseSlice[] = [
    ...ENGINEERING_FINISHING_PHASES,
    "NOT_STARTED" as FinishingPhase,
  ]
    .map((phase) => ({
      phase,
      count: phaseCounts.get(phase) ?? 0,
    }))
    .filter((slice) => slice.count > 0);

  return {
    totalUnits,
    deliveredUnits,
    legalRiskUnits,
    pendingHandoverUnits,
    deliveryOverdue,
    deliveryDueThisMonth,
    followUpDueToday,
    followUpOverdue,
    feesOutstanding,
    finishingInProgress,
    finishingComplete,
    handoverPipeline: (
      ["pending", "inProgress", "delivered", "atRisk"] as HandoverPipelineBucket[]
    ).map((key) => ({ key, count: handoverCounts[key] })),
    finishingPhases,
    signedProtocol: [
      { key: "uploaded", count: signedUploadedResolved },
      { key: "missing", count: signedMissingResolved },
    ],
  };
}
