"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { signIn, getSession, signOut, useSession } from "next-auth/react";
import { AlertCircle } from "lucide-react";

import {
  getPostAuthRedirect,
  resolveLocale,
} from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NjdMark } from "@/components/brand/njd-mark";

async function waitForSession(maxAttempts = 15) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const session = await getSession();
    if (session?.user?.role) {
      return session;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

export default function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "session_expired") {
      setInfo(t("loginSessionExpired"));
      void signOut({ redirect: false });
    }
  }, [searchParams, t]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.role) {
      return;
    }

    const reason = searchParams.get("reason");
    if (reason === "session_expired") {
      return;
    }

    window.location.assign(
      getPostAuthRedirect(resolveLocale(locale), {
        requiresPasswordChange: session.user.requiresPasswordChange,
        needs2FASetup: session.user.needs2FASetup,
        twoFactorVerified: session.user.twoFactorVerified,
        role: session.user.role,
      })
    );
  }, [locale, searchParams, session, status]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const formData = new FormData(e.currentTarget);
      const email = String(formData.get("email")).trim();
      const password = String(formData.get("password"));

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error || result.ok === false) {
        setError(t("loginInvalidCredentials"));
        return;
      }

      const activeSession = await waitForSession();
      if (!activeSession?.user?.role) {
        setError(t("loginSessionFailed"));
        return;
      }

      window.location.assign(
        getPostAuthRedirect(resolveLocale(locale), {
          requiresPasswordChange: activeSession.user.requiresPasswordChange,
          needs2FASetup: activeSession.user.needs2FASetup,
          twoFactorVerified: activeSession.user.twoFactorVerified,
          role: activeSession.user.role,
        })
      );
    } catch {
      setError(t("loginSessionFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <NjdMark size={48} className="rounded-xl shadow-md" />
            <div className="space-y-1">
              <p className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                NJD Post-Sales CRM
              </p>
              <CardTitle>{t("login")}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>

            {info ? (
              <div
                role="status"
                className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{info}</p>
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("loginSigningIn") : t("login")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
