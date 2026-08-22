import { getLocale } from "next-intl/server";

import { SystemSecurityPanel } from "@/components/system/system-security-panel";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { parseBrowserLabel } from "@/lib/system/parse-user-agent";
import { prisma } from "@/lib/prisma";

export default async function SystemSecurityPage() {
  const [session, locale] = await Promise.all([
    requireSuperAdmin(),
    getLocale(),
  ]);

  const [historyRows, users] = await Promise.all([
    prisma.loginHistory.findMany({
      orderBy: { timestamp: "desc" },
      take: 250,
      select: {
        id: true,
        email: true,
        ipAddress: true,
        userAgent: true,
        status: true,
        timestamp: true,
      },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lastLoginAt: true,
        sessionVersion: true,
      },
    }),
  ]);

  return (
    <SystemSecurityPanel
      currentUserId={session.user.id}
      loginHistory={historyRows.map((row) => ({
        id: row.id,
        email: row.email,
        ipAddress: row.ipAddress,
        browser: parseBrowserLabel(row.userAgent),
        status: row.status,
        timestampLabel: row.timestamp.toLocaleString(locale),
      }))}
      users={users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        sessionVersion: user.sessionVersion,
        lastLoginLabel: user.lastLoginAt
          ? user.lastLoginAt.toLocaleString(locale)
          : "—",
      }))}
    />
  );
}
