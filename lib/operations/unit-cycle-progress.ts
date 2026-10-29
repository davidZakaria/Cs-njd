import type {
  ContractWorkflow,
  EngineeringApprovalKind,
  Finishing,
  FinishingPhase,
  Unit,
  UnitCycleStageKey,
} from "@prisma/client";

import { assessFinishingFinancialData } from "@/lib/finishing/financial-data-quality";
import {
  hasTrackedFinishingWork,
  isFinishingChecklistEnabled,
  isFinishingWorkComplete,
  isFullyFinishedPackage,
} from "@/lib/finishing/phases";

export const UNIT_CYCLE_STAGE_ORDER = [
  "CONTRACT",
  "FINANCE",
  "ENGINEERING",
  "LEGAL_HANDOVER",
] as const satisfies readonly UnitCycleStageKey[];

export type UnitCycleChecklistItemKey =
  | "contract_date_recorded"
  | "sale_contract_flagged"
  | "signed_contract_uploaded"
  | "delivery_date_recorded"
  | "fees_paid_when_due"
  | "finishing_finance_clear"
  | "finishing_work_complete"
  | "modifications_complete"
  | "cs_engineering_approval"
  | "handover_papers_complete"
  | "not_legally_blocked"
  | "handover_protocol_signed"
  | "paper_handover_complete";

export type UnitCycleChecklistItem = {
  key: UnitCycleChecklistItemKey;
  passed: boolean;
};

export type UnitOperationsSnapshot = {
  unit: Pick<Unit, "contractPricePerMeter" | "area">;
  contractWorkflow: Pick<
    ContractWorkflow,
    | "contractDate"
    | "deliveryDate"
    | "hasPreliminarySaleContract"
    | "hasFinalSaleContract"
    | "signedContractFile"
    | "hasPaidFees"
    | "hasSignedProtocol"
    | "hasSignedExtension"
    | "papersReceived"
    | "handoverStatus"
    | "isLegallyBlocked"
    | "paperHandoverOriginalProtocol"
    | "paperHandoverKeyReceived"
  > | null;
  finishing: Pick<
    Finishing,
    | "phases"
    | "phase"
    | "packageType"
    | "doorFees"
    | "aluminumFees"
    | "customModifications"
    | "modificationsCompleted"
    | "totalFinishingPrice"
    | "pricePerMeter"
  > | null;
  engineeringReadinessSignedOff: boolean;
};

export const ENGINEERING_CYCLE_APPROVAL_KIND: EngineeringApprovalKind =
  "READINESS_SIGN_OFF";

export function hasEngineeringCycleApproval(
  approvals: { kind: EngineeringApprovalKind }[] | null | undefined
): boolean {
  return (
    approvals?.some((row) => row.kind === ENGINEERING_CYCLE_APPROVAL_KIND) ??
    false
  );
}

const STAGE_CHECKLIST_KEYS: Record<UnitCycleStageKey, UnitCycleChecklistItemKey[]> =
  {
    CONTRACT: [
      "contract_date_recorded",
      "sale_contract_flagged",
      "signed_contract_uploaded",
      "delivery_date_recorded",
    ],
    FINANCE: ["fees_paid_when_due", "finishing_finance_clear"],
    ENGINEERING: [
      "finishing_work_complete",
      "modifications_complete",
      "cs_engineering_approval",
    ],
    LEGAL_HANDOVER: [
      "handover_papers_complete",
      "not_legally_blocked",
      "handover_protocol_signed",
      "paper_handover_complete",
    ],
  };

function finishingPhases(snapshot: UnitOperationsSnapshot): FinishingPhase[] {
  if (snapshot.finishing?.phases?.length) {
    return snapshot.finishing.phases;
  }
  if (snapshot.finishing?.phase) {
    return [snapshot.finishing.phase];
  }
  return [];
}

function evaluateChecklistItem(
  key: UnitCycleChecklistItemKey,
  snapshot: UnitOperationsSnapshot
): boolean {
  const workflow = snapshot.contractWorkflow;
  const finishing = snapshot.finishing;

  switch (key) {
    case "contract_date_recorded":
      return Boolean(workflow?.contractDate);
    case "sale_contract_flagged":
      return Boolean(
        workflow?.hasPreliminarySaleContract || workflow?.hasFinalSaleContract
      );
    case "signed_contract_uploaded":
      return Boolean(workflow?.signedContractFile);
    case "delivery_date_recorded":
      return Boolean(workflow?.deliveryDate);
    case "fees_paid_when_due": {
      const doorFees = finishing?.doorFees ?? 0;
      const aluminumFees = finishing?.aluminumFees ?? 0;
      if (doorFees <= 0 && aluminumFees <= 0) return true;
      return Boolean(workflow?.hasPaidFees);
    }
    case "finishing_finance_clear": {
      const assessment = assessFinishingFinancialData({
        totalFinishingPrice: finishing?.totalFinishingPrice,
        doorFees: finishing?.doorFees,
        aluminumFees: finishing?.aluminumFees,
        area: snapshot.unit.area,
        pricePerMeter: finishing?.pricePerMeter,
      });
      return !assessment.showInFinanceDataCheck;
    }
    case "finishing_work_complete": {
      const packageType = finishing?.packageType ?? null;
      const phases = finishingPhases(snapshot);
      if (!isFinishingChecklistEnabled(packageType)) {
        if (isFullyFinishedPackage(packageType)) {
          return isFinishingWorkComplete(phases);
        }
        if (hasTrackedFinishingWork(phases)) {
          return isFinishingWorkComplete(phases);
        }
        return true;
      }
      return isFinishingWorkComplete(phases);
    }
    case "modifications_complete": {
      const customMods = finishing?.customModifications?.trim();
      if (!customMods) return true;
      return finishing?.modificationsCompleted !== false;
    }
    case "cs_engineering_approval":
      return snapshot.engineeringReadinessSignedOff;
    case "handover_papers_complete": {
      if (!workflow) return false;
      const needsExtension = workflow.handoverStatus === "DELIVERY_EXTENSION";
      return (
        workflow.hasSignedProtocol &&
        workflow.papersReceived &&
        (!needsExtension || workflow.hasSignedExtension)
      );
    }
    case "not_legally_blocked":
      return workflow?.isLegallyBlocked !== true;
    case "handover_protocol_signed":
      return Boolean(workflow?.hasSignedProtocol);
    case "paper_handover_complete":
      return Boolean(
        workflow?.paperHandoverOriginalProtocol && workflow?.paperHandoverKeyReceived
      );
    default:
      return false;
  }
}

export function checklistKeysForStage(
  stageKey: UnitCycleStageKey
): UnitCycleChecklistItemKey[] {
  return STAGE_CHECKLIST_KEYS[stageKey];
}

export function buildStageChecklist(
  stageKey: UnitCycleStageKey,
  snapshot: UnitOperationsSnapshot
): UnitCycleChecklistItem[] {
  return checklistKeysForStage(stageKey).map((key) => ({
    key,
    passed: evaluateChecklistItem(key, snapshot),
  }));
}

export function isStageChecklistComplete(
  stageKey: UnitCycleStageKey,
  snapshot: UnitOperationsSnapshot
): boolean {
  return buildStageChecklist(stageKey, snapshot).every((item) => item.passed);
}

export function deriveCompletedStageKeys(
  snapshot: UnitOperationsSnapshot
): UnitCycleStageKey[] {
  const completed: UnitCycleStageKey[] = [];
  for (const stageKey of UNIT_CYCLE_STAGE_ORDER) {
    if (isStageChecklistComplete(stageKey, snapshot)) {
      completed.push(stageKey);
    } else {
      break;
    }
  }
  return completed;
}

export function resolveActiveStageKey(
  stages: { stageKey: UnitCycleStageKey; status: string }[]
): UnitCycleStageKey | null {
  for (const stageKey of UNIT_CYCLE_STAGE_ORDER) {
    const row = stages.find((stage) => stage.stageKey === stageKey);
    if (!row || row.status !== "DONE") {
      return stageKey;
    }
  }
  return null;
}
