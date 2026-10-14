export const AUDITED_MODELS = [
  "Client",
  "ClientPhone",
  "ClientAddress",
  "Unit",
  "ContractWorkflow",
  "Finishing",
  "Ticket",
  "User",
] as const;

export type AuditedModel = (typeof AUDITED_MODELS)[number];

export function isAuditedModel(model: string): model is AuditedModel {
  return (AUDITED_MODELS as readonly string[]).includes(model);
}
