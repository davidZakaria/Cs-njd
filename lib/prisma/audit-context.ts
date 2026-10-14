import { AsyncLocalStorage } from "async_hooks";

export type AuditContextStore = {
  userId?: string;
  ipAddress?: string;
};

export const auditContext = new AsyncLocalStorage<AuditContextStore>();
