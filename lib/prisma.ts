import { PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";
import type { AuditAction } from "@prisma/client";

export const auditContext = new AsyncLocalStorage<{
  userId?: string;
  ipAddress?: string;
}>();

export const basePrisma = new PrismaClient();

const auditedModels = ["Client", "Unit", "ContractWorkflow"] as const;

function modelDelegate(model: string) {
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (basePrisma as any)[key];
}

function normalizeWhere(where: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(where);
  if (keys.length === 1 && keys[0].includes("_") && typeof where[keys[0]] === "object") {
    return where[keys[0]] as Record<string, unknown>;
  }
  return where;
}

function createAuditExtension() {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!auditedModels.includes(model as (typeof auditedModels)[number])) {
            return query(args);
          }

          const ctx = auditContext.getStore();
          const isMutation = ["create", "update", "delete", "upsert"].includes(operation);

          if (!isMutation) {
            return query(args);
          }

          let oldData: unknown = null;
          if (operation === "update" || operation === "delete" || operation === "upsert") {
            const where = (args as { where?: Record<string, unknown> }).where;
            if (where) {
              try {
                oldData = await modelDelegate(model).findFirst({
                  where: normalizeWhere(where),
                });
              } catch {
                oldData = null;
              }
            }
          }

          const result = await query(args);

          const actionMap: Record<string, AuditAction> = {
            create: "CREATE",
            update: "UPDATE",
            delete: "DELETE",
            upsert: oldData ? "UPDATE" : "CREATE",
          };

          const recordId =
            (result as { id?: string })?.id ??
            (args as { where?: { id?: string } }).where?.id ??
            "unknown";

          if (ctx?.userId) {
            await basePrisma.auditLog.create({
              data: {
                userId: ctx.userId,
                action: actionMap[operation] ?? "UPDATE",
                tableName: model,
                recordId: String(recordId),
                oldData: oldData ? (oldData as object) : undefined,
                newData: operation !== "delete" ? (result as object) : undefined,
                ipAddress: ctx?.ipAddress,
              },
            });
          }

          return result;
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createAuditExtension> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createAuditExtension();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
