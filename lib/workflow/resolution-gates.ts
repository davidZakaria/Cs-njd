import type {
  ContractWorkflow,
  FinishingPhase,
  PendingParty,
  Ticket,
} from "@prisma/client";
import {
  hasTrackedFinishingWork,
  isFinishingWorkComplete,
} from "@/lib/finishing/phases";

export const RESOLUTION_GATE_CODES = [
  "finishing_not_done",
  "fees_unpaid",
  "missing_papers",
  "party_not_none",
] as const;

export type ResolutionGateCode = (typeof RESOLUTION_GATE_CODES)[number];

type GateContext = {
  ticket: Pick<Ticket, "pendingParty">;
  finishing: {
    phases?: FinishingPhase[] | null;
    phase?: FinishingPhase | null;
    doorFees: number | null;
    aluminumFees: number | null;
  } | null;
  contractWorkflow: Pick<
    ContractWorkflow,
    | "hasSignedProtocol"
    | "hasSignedExtension"
    | "hasPaidFees"
    | "papersReceived"
    | "handoverStatus"
  > | null;
};

export function evaluateResolutionGates(ctx: GateContext): ResolutionGateCode[] {
  const failures: ResolutionGateCode[] = [];

  const pendingParty = ctx.ticket.pendingParty ?? "NONE";
  if (pendingParty !== "NONE") {
    failures.push("party_not_none");
  }

  const phases = ctx.finishing?.phases?.length
    ? ctx.finishing.phases
    : ctx.finishing?.phase
      ? [ctx.finishing.phase]
      : [];

  if (hasTrackedFinishingWork(phases) && !isFinishingWorkComplete(phases)) {
    failures.push("finishing_not_done");
  }

  const doorFees = ctx.finishing?.doorFees ?? 0;
  const aluminumFees = ctx.finishing?.aluminumFees ?? 0;
  if ((doorFees > 0 || aluminumFees > 0) && !ctx.contractWorkflow?.hasPaidFees) {
    failures.push("fees_unpaid");
  }

  const workflow = ctx.contractWorkflow;
  if (workflow) {
    const needsExtension = workflow.handoverStatus === "DELIVERY_EXTENSION";
    const papersComplete =
      workflow.hasSignedProtocol &&
      workflow.papersReceived &&
      (!needsExtension || workflow.hasSignedExtension);
    if (!papersComplete) {
      failures.push("missing_papers");
    }
  }

  return failures;
}

export function mergeTicketWorkflowFields(
  ticket: Pick<Ticket, "pendingParty" | "nextFollowUpDate">,
  input: {
    pendingParty?: PendingParty | null;
    nextFollowUpDate?: Date | null;
  }
): Pick<Ticket, "pendingParty" | "nextFollowUpDate"> {
  return {
    pendingParty:
      input.pendingParty !== undefined ? input.pendingParty : ticket.pendingParty,
    nextFollowUpDate:
      input.nextFollowUpDate !== undefined
        ? input.nextFollowUpDate
        : ticket.nextFollowUpDate,
  };
}
