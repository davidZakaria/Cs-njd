import type { HandoverTemplateKey } from "@/lib/print/handover-templates/types";

export const GREEN_AVENUE_HANDOVER_TEMPLATE_KEYS: HandoverTemplateKey[] = [
  "green-avenue",
  "green-avenue-no-insurance",
  "green-avenue-dual",
  "green-avenue-dual-no-insurance",
];

export const JURA_HANDOVER_TEMPLATE_KEYS: HandoverTemplateKey[] = [
  "jura",
  "jura-dual",
];

export function listOfficialHandoverTemplateKeysForProject(
  projectName: string
): HandoverTemplateKey[] {
  if (projectName === "JURA") return JURA_HANDOVER_TEMPLATE_KEYS;
  if (projectName === "GREEN AVENUE") return GREEN_AVENUE_HANDOVER_TEMPLATE_KEYS;
  return [];
}

export function officialHandoverVariantLabelKey(
  key: HandoverTemplateKey
): string {
  const map: Record<HandoverTemplateKey, string> = {
    "green-avenue": "handoverVariantGreen1OwnerDeposit",
    "green-avenue-no-insurance": "handoverVariantGreen1OwnerNoDeposit",
    "green-avenue-dual": "handoverVariantGreen2OwnersDeposit",
    "green-avenue-dual-no-insurance": "handoverVariantGreen2OwnersNoDeposit",
    jura: "handoverVariantJura1Owner",
    "jura-dual": "handoverVariantJura2Owners",
  };
  return map[key];
}
