import { prisma } from "@/lib/prisma";

export type DatabaseMetrics = {
  sizePretty: string;
  sizeBytes: number;
  activeConnections: number;
};

type DatabaseSizeRow = {
  size: string;
  size_bytes: bigint | number;
};

type ActiveConnectionsRow = {
  count: number;
};

export async function getDatabaseMetrics(): Promise<DatabaseMetrics> {
  const [sizeRows, connectionRows] = await Promise.all([
    prisma.$queryRawUnsafe<DatabaseSizeRow[]>(
      `SELECT pg_size_pretty(pg_database_size(current_database())) AS size,
              pg_database_size(current_database()) AS size_bytes;`
    ),
    prisma.$queryRawUnsafe<ActiveConnectionsRow[]>(
      `SELECT count(*)::int AS count FROM pg_stat_activity;`
    ),
  ]);

  return {
    sizePretty: sizeRows[0]?.size ?? "—",
    sizeBytes: Number(sizeRows[0]?.size_bytes ?? 0),
    activeConnections: connectionRows[0]?.count ?? 0,
  };
}
