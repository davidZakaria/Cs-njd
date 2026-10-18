import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { auditContext } from "@/lib/prisma";

export async function withAudit<T>(fn: () => Promise<T>): Promise<T> {
  const session = await auth();
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";
  return auditContext.run(
    { userId: session?.user?.id, ipAddress: ip },
    async () => await fn()
  );
}

/** Scripts / jobs without a request session (e.g. split-joint-owners --apply). */
export async function withAuditAsUser<T>(
  userId: string,
  fn: () => Promise<T>,
  ipAddress = "script"
): Promise<T> {
  return auditContext.run({ userId, ipAddress }, async () => await fn());
}
