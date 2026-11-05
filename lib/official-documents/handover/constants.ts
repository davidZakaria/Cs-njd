import type { HandoverTemplateKey } from "@/lib/print/handover-templates/types";

export const OFFICIAL_HANDOVER_MISSING_OPEN = "⟦";
export const OFFICIAL_HANDOVER_MISSING_CLOSE = "⟧";

export function formatOfficialHandoverMissingToken(fieldKey: string): string {
  return `${OFFICIAL_HANDOVER_MISSING_OPEN}${fieldKey}${OFFICIAL_HANDOVER_MISSING_CLOSE}`;
}

export const OFFICIAL_HANDOVER_MISSING_PATTERN = /⟦([\w]+)⟧/g;

export function handoverUsesOfficialMasters(projectName: string): boolean {
  return projectName === "GREEN AVENUE" || projectName === "JURA";
}

const LOGO_BY_KEY: Record<HandoverTemplateKey, string> = {
  "green-avenue": "green-handover-1owner-deposit-image1.png",
  "green-avenue-no-insurance": "green-handover-1owner-nodeposit-image1.png",
  "green-avenue-dual": "green-handover-2owners-deposit-image1.png",
  "green-avenue-dual-no-insurance": "green-handover-2owners-nodeposit-image1.png",
  jura: "jura-handover-1owner-image1.jpg",
  "jura-dual": "jura-handover-2owners-image1.jpg",
};

export function handoverLogoAssetRelativePath(key: HandoverTemplateKey): string {
  return `lib/official-documents/handover/assets/${LOGO_BY_KEY[key]}`;
}
