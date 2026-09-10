import type {
  ContractWorkflow,
  FinishingPhase,
  FinishingPackage,
  PendingParty,
  Ticket,
} from "@prisma/client";

import {
  evaluateResolutionGates,
  RESOLUTION_GATE_CODES,
  type ResolutionGateCode,
} from "@/lib/workflow/resolution-gates";

export type ResolutionChecklistContext = {
  ticket: Pick<Ticket, "pendingParty">;
  finishing: {
    phases?: FinishingPhase[] | null;
    phase?: FinishingPhase | null;
    packageType?: FinishingPackage | null;
    doorFees: number | null;
    aluminumFees: number | null;
    customModifications?: string | null;
    modificationsCompleted?: boolean | null;
  } | null;
  contractWorkflow: Pick<
    ContractWorkflow,
    | "hasSignedProtocol"
    | "hasSignedExtension"
    | "hasPaidFees"
    | "papersReceived"
    | "handoverStatus"
    | "isLegallyBlocked"
    | "signedContractFile"
  > | null;
};

export type ResolutionChecklistItem = {
  code: ResolutionGateCode;
  passed: boolean;
};

export function buildResolutionChecklist(
  ctx: ResolutionChecklistContext
): ResolutionChecklistItem[] {
  const failures = new Set(evaluateResolutionGates(ctx));

  return RESOLUTION_GATE_CODES.map((code) => ({
    code,
    passed: !failures.has(code),
  }));
}

export function allResolutionChecksPassed(items: ResolutionChecklistItem[]): boolean {
  return items.every((item) => item.passed);
}

/** Serializable snapshot for client components (Unit 360 props). */
export type SerializedResolutionContext = {
  ticketPendingParty: PendingParty | null;
  finishing: ResolutionChecklistContext["finishing"];
  contractWorkflow: ResolutionChecklistContext["contractWorkflow"];
};

export function buildChecklistFromSerialized(
  ctx: SerializedResolutionContext
): ResolutionChecklistItem[] {
  return buildResolutionChecklist({
    ticket: { pendingParty: ctx.ticketPendingParty },
    finishing: ctx.finishing,
    contractWorkflow: ctx.contractWorkflow,
  });
}
