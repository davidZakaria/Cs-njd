"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { AlertCircle } from "lucide-react";

import { getPostAuthPath } from "@/lib/auth-redirect";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "session_expired") {
      setInfo(t("loginSessionExpired"));
    }
  }, [searchParams, t]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email")).trim();
    const password = String(formData.get("password"));

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(t("loginInvalidCredentials"));
      setLoading(false);
      return;
    }

    const session = await getSession();
    if (!session?.user?.role) {
      setError(t("loginSessionFailed"));
      setLoading(false);
      return;
    }

    router.replace(
      getPostAuthPath({
        requiresPasswordChange: session.user.requiresPasswordChange,
        needs2FASetup: session.user.needs2FASetup,
        twoFactorVerified: session.user.twoFactorVerified,
        role: session.user.role,
      })
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("login")}</CardTitle>
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
