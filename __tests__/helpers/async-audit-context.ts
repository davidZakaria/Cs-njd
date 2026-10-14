import { AsyncLocalStorage } from "async_hooks";

export type AuditContextStore = {
  userId?: string;
  ipAddress?: string;
};

export const asyncAuditContext = new AsyncLocalStorage<AuditContextStore>();

export function runWithAsyncAuditContext<T>(
  ctx: AuditContextStore,
  fn: () => Promise<T>
): Promise<T> {
  return asyncAuditContext.run(ctx, async () => await fn());
}

export type SimulatedAuditRow = {
  userId: string;
  tableName: string;
  action: "CREATE" | "UPDATE" | "DELETE";
};

export function recordAuditRowIfContext(
  tableName: string,
  action: SimulatedAuditRow["action"],
  rows: SimulatedAuditRow[]
) {
  const ctx = asyncAuditContext.getStore();
  if (ctx?.userId) {
    rows.push({ userId: ctx.userId, tableName, action });
  }
}
