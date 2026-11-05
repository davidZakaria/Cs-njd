import type { UnitMergeInput } from "@/lib/official-documents/merge-fields";
import type { HandoverTemplateOptions } from "@/lib/print/handover-templates/types";
import {
  resolveHandoverTemplateKey,
} from "@/lib/print/handover-templates/resolve";
import type { HandoverTemplateKey } from "@/lib/print/handover-templates/types";

import { handoverUsesOfficialMasters } from "./constants";

/** Buyer-finishing units use Green Avenue masters that include finishing-insurance clauses. */
export function inferHandoverFinishingDepositApplies(
  unit: UnitMergeInput
): boolean {
  const finishing = unit.finishing;
  if (!finishing) return false;

  const buyerFinishingTypes = new Set([
    "CORE_AND_SHELL",
    "SEMI_FINISHED",
    "PLASTER_ONLY",
    "THREE_QUARTER",
    "CUSTOM",
  ]);
  if (buyerFinishingTypes.has(finishing.finishingType)) return true;

  const buyerPackages = new Set(["CORE_AND_SHELL", "THREE_QUARTERS"]);
  if (finishing.packageType && buyerPackages.has(finishing.packageType)) {
    return true;
  }

  return false;
}

export function inferHandoverTemplateOptionsFromUnit(
  unit: UnitMergeInput
): HandoverTemplateOptions {
  const coOwners = unit.unitClients.filter((link) => link.role === "CO_OWNER");
  const dualSignature = coOwners.length > 0;

  if (unit.project.name === "JURA") {
    return { insurance: true, dualSignature };
  }

  if (unit.project.name === "GREEN AVENUE") {
    return {
      insurance: inferHandoverFinishingDepositApplies(unit),
      dualSignature,
    };
  }

  return { insurance: true, dualSignature: false };
}

export function resolveOfficialHandoverTemplateKey(
  unit: UnitMergeInput,
  overrideKey?: HandoverTemplateKey | null
): HandoverTemplateKey | null {
  if (!handoverUsesOfficialMasters(unit.project.name)) return null;
  if (overrideKey) return overrideKey;
  return resolveHandoverTemplateKey(
    unit.project.name,
    inferHandoverTemplateOptionsFromUnit(unit)
  );
}
