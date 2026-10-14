const AUDIT_TABLE_NAME_KEYS = [
  "Client",
  "ClientPhone",
  "ClientAddress",
  "Unit",
  "ContractWorkflow",
  "Finishing",
  "Ticket",
  "User",
] as const;

export type AuditTableNameKey = (typeof AUDIT_TABLE_NAME_KEYS)[number];

export function auditTableNameTranslationKey(
  tableName: string
): `tables.${AuditTableNameKey}` | null {
  if ((AUDIT_TABLE_NAME_KEYS as readonly string[]).includes(tableName)) {
    return `tables.${tableName as AuditTableNameKey}`;
  }
  return null;
}
