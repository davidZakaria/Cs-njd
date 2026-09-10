"use client";

import { SessionProvider } from "next-auth/react";

import { SessionGuard } from "@/components/auth/session-guard";
import { ClientSecurityGuard } from "@/components/security/ClientSecurityGuard";
import {
  SESSION_MAX_AGE_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
} from "@/lib/auth/session-constants";

export default function DashboardProviders({
  children,
  userEmail = "",
  securityGuardEnabled = true,
}: {
  children: React.ReactNode;
  userEmail?: string;
  securityGuardEnabled?: boolean;
}) {
  return (
    <SessionProvider
      refetchOnWindowFocus
      refetchInterval={Math.min(SESSION_UPDATE_AGE_SECONDS, 300)}
    >
      <SessionGuard />
      {securityGuardEnabled ? <ClientSecurityGuard userEmail={userEmail} /> : null}
      {children}
    </SessionProvider>
  );
}
