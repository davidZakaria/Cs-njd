import { PrismaClient } from "@prisma/client";

import { auditContext } from "@/lib/prisma/audit-context";
import { isAuditedModel } from "@/lib/prisma/audited-models";
import {
  fetchRowsForBulkWhere,
  recordCreateManyAndReturnAudits,
  recordDeleteManyAudits,
  recordUpdateManyAudits,
  singleMutationAction,
} from "@/lib/prisma/bulk-audit";
import { recordAuditLog } from "@/lib/prisma/record-audit-log";
import {
  archivedUserEmail,
  isSoftDeleteModel,
  mergeNotDeleted,
} from "@/lib/prisma/soft-delete";

export { auditContext } from "@/lib/prisma/audit-context";
export { notDeleted, activeTicketWhere, activeUnitWhere, activeContractWorkflowWhere } from "@/lib/prisma/soft-delete";

export const basePrisma = new PrismaClient();

const extendedPrismaRef: {
  current: ReturnType<typeof createAuditExtension> | null;
} = { current: null };

function modelDelegate(model: string) {
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (basePrisma as any)[key];
}

function modelDelegateOnExtendedClient(model: string) {
  const client = extendedPrismaRef.current;
  if (!client) {
    throw new Error("Extended Prisma client is not initialized");
  }
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any)[key];
}

function normalizeWhere(where: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(where);
  if (keys.length === 1 && keys[0].includes("_") && typeof where[keys[0]] === "object") {
    return where[keys[0]] as Record<string, unknown>;
  }
  return where;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function createSoftDeleteExtension(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            args.where = mergeNotDeleted(args.where);
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            args.where = mergeNotDeleted(args.where);
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            args.where = mergeNotDeleted(args.where);
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (isSoftDeleteModel(model)) {
            args.where = mergeNotDeleted(args.where);
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (!isSoftDeleteModel(model)) {
            return query(args);
          }

          const delegate = modelDelegate(model);
          const data: Record<string, unknown> = { deletedAt: new Date() };

          if (model === "User") {
            const where = (args as { where?: { id?: string } }).where;
            if (where?.id) {
              data.email = archivedUserEmail(where.id);
            }
          }

          return delegate.update({
            where: (args as { where: Record<string, unknown> }).where,
            data,
          });
        },
      },
    },
  });
}

function createAuditExtension(client: ReturnType<typeof createSoftDeleteExtension>) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!isAuditedModel(model)) {
            return query(args);
          }

          const ctx = auditContext.getStore();
          const isSingleMutation = ["create", "update", "delete", "upsert"].includes(
            operation
          );
          const isBulkMutation = ["createMany", "createManyAndReturn", "updateMany", "deleteMany"].includes(
            operation
          );

          if (!isSingleMutation && !isBulkMutation) {
            return query(args);
          }

          if (!ctx?.userId) {
            return query(args);
          }

          if (operation === "createMany") {
            const items = Array.isArray(
              (args as { data?: unknown }).data
            )
              ? ((args as { data: Record<string, unknown>[] }).data)
              : [(args as { data: Record<string, unknown> }).data];
            const skipDuplicates = Boolean(
              (args as { skipDuplicates?: boolean }).skipDuplicates
            );
            const delegate = modelDelegateOnExtendedClient(model);
            let count = 0;

            for (const item of items) {
              try {
                await delegate.create({ data: item });
                count += 1;
              } catch (error) {
                if (skipDuplicates && isUniqueConstraintError(error)) {
                  continue;
                }
                throw error;
              }
            }

            return { count };
          }

          if (operation === "createManyAndReturn") {
            const result = (await query(args)) as Array<{ id: string } & Record<string, unknown>>;
            await recordCreateManyAndReturnAudits(basePrisma, ctx, model, result);
            return result;
          }

          if (operation === "deleteMany") {
            const where = (args as { where?: Record<string, unknown> }).where;
            await recordDeleteManyAudits(
              modelDelegate(model),
              basePrisma,
              ctx,
              model,
              where
            );
            return query(args);
          }

          if (operation === "updateMany") {
            const where = (args as { where?: Record<string, unknown> }).where;
            const delegate = modelDelegate(model);
            const beforeRows = await fetchRowsForBulkWhere(delegate, model, where);
            const result = await query(args);
            await recordUpdateManyAudits(
              delegate,
              basePrisma,
              ctx,
              model,
              beforeRows
            );
            return result;
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

          const recordId =
            (result as { id?: string })?.id ??
            (args as { where?: { id?: string } }).where?.id ??
            "unknown";

          const auditAction = singleMutationAction(
            operation,
            model,
            Boolean(oldData)
          );

          await recordAuditLog(basePrisma, ctx, {
            model,
            action: auditAction,
            recordId: String(recordId),
            oldData: oldData ? (oldData as object) : undefined,
            newData: operation !== "delete" ? (result as object) : undefined,
          });

          return result;
        },
      },
    },
  });
}

const prismaWithSoftDelete = createSoftDeleteExtension(basePrisma);

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createAuditExtension> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createAuditExtension(prismaWithSoftDelete);
extendedPrismaRef.current = prisma;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
