"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { signOut, useSession } from "next-auth/react";

import { SESSION_REVOKED_ERROR } from "@/lib/auth/session-constants";

function redirectToLogin(locale: string) {
  const target = `/${locale}/login?reason=session_expired`;
  if (window.location.pathname.includes("/login")) return;
  window.location.assign(target);
}

export function SessionGuard() {
  const locale = useLocale();
  const { data: session, status } = useSession();
  const handling = useRef(false);

  useEffect(() => {
    if (handling.current || status === "loading") {
      return;
    }

    if (status === "unauthenticated") {
      handling.current = true;
      redirectToLogin(locale);
      return;
    }

    if (
      status === "authenticated" &&
      session?.error === SESSION_REVOKED_ERROR
    ) {
      handling.current = true;
      void signOut({ redirect: false }).finally(() => {
        redirectToLogin(locale);
      });
    }
  }, [locale, session?.error, status]);

  return null;
}
