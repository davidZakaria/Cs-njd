"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { AlertCircle, Check, Copy, Loader2 } from "lucide-react";

import {
  getPostAuthRedirect,
  resolveLocale,
} from "@/lib/auth-redirect";
import type { ActionResult } from "@/lib/actions/result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SetupData = ActionResult & { secret?: string; qrDataUrl?: string };

const SETUP_ERROR_CODES = [
  "SESSION_EXPIRED",
  "USER_NOT_FOUND",
  "QR_GENERATION_FAILED",
  "SETUP_EXPIRED",
  "INVALID_CODE",
  "Unauthorized",
] as const;

async function fetchSetupData(resetFirst = false): Promise<SetupData> {
  if (resetFirst) {
    await fetch("/api/auth/reset-2fa-setup", {
      method: "POST",
      credentials: "include",
    });
  }

  const response = await fetch("/api/auth/setup-2fa", {
    credentials: "include",
    cache: "no-store",
  });

  return (await response.json()) as SetupData;
}

export default function Setup2FAPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { data: session, status, update } = useSession();
  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const resolveSetupError = useCallback(
    (code: string | undefined) => {
      if (!code) return t("qrLoadFailed");
      if (code === "Unauthorized") return t("verifyErrors.SESSION_EXPIRED");
      if (code === "SETUP_EXPIRED") {
        return t("setupExpired");
      }
      if (code === "QR_GENERATION_FAILED") return t("qrLoadFailed");
      if (code === "INVALID_CODE") return t("invalidCode");
      if (
        SETUP_ERROR_CODES.includes(code as (typeof SETUP_ERROR_CODES)[number])
      ) {
        return t(`verifyErrors.${code}` as "verifyErrors.SESSION_EXPIRED");
      }
      return code;
    },
    [t]
  );

  const loadSetup = useCallback(
    async (forceReset = false) => {
      setLoading(true);
      setError("");

      try {
        const result = await fetchSetupData(forceReset);
        if (!result.success) {
          setError(resolveSetupError(result.error));
          setSecret("");
          setQrDataUrl("");
          return;
        }

        setSecret(result.secret ?? "");
        setQrDataUrl(result.qrDataUrl ?? "");
        setToken("");
      } catch {
        setError(t("qrLoadFailed"));
        setSecret("");
        setQrDataUrl("");
      } finally {
        setLoading(false);
      }
    },
    [resolveSetupError, t]
  );

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      setLoading(false);
      window.location.assign(`/${resolveLocale(locale)}/login`);
      return;
    }

    void loadSetup();
  }, [locale, loadSetup, status]);

  async function copySecret() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!secret) {
      setError(t("setupNotReady"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/confirm-setup-2fa", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, token }),
      });

      const result = (await response.json()) as ActionResult;
      if (!result.success) {
        setError(resolveSetupError(result.error));
        return;
      }

      await update({
        needs2FASetup: false,
        is2FAEnabled: true,
        twoFactorVerified: true,
      });

      window.location.assign(
        getPostAuthRedirect(resolveLocale(locale), {
          requiresPasswordChange: session?.user.requiresPasswordChange ?? false,
          needs2FASetup: false,
          twoFactorVerified: true,
          role: session!.user.role,
        })
      );
    } catch {
      setError(t("verifyUnexpectedError"));
    } finally {
      setSubmitting(false);
    }
  }

  const busy = loading || submitting;

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("setup2fa")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("scanQr")}</p>

          {loading ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-center text-sm text-muted-foreground">
                {t("loadingQr")}
              </p>
            </div>
          ) : qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={t("qrAlt")}
              width={220}
              height={220}
              className="mx-auto rounded-md border bg-white p-2"
            />
          ) : (
            <div className="space-y-2 text-center">
              <div
                role="alert"
                className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-start text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{error || t("qrLoadFailed")}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadSetup(true)}
              >
                {t("startOver")}
              </Button>
            </div>
          )}

          {secret ? (
            <div className="space-y-3 rounded-md border bg-muted/40 p-3 text-sm">
              <div>
                <p className="mb-1 font-medium">{t("manualSecret")}</p>
                <div className="flex items-start gap-2">
                  <p className="flex-1 break-all font-mono text-xs">{secret}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => void copySecret()}
                  >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? t("copied") : t("copyKey")}
                  </Button>
                </div>
              </div>
              <ol className="list-decimal space-y-1 ps-4 text-muted-foreground">
                <li>{t("manualStep1")}</li>
                <li>{t("manualStep2")}</li>
                <li>{t("manualStep3", { name: "NJD CRM" })}</li>
                <li>{t("manualStep4")}</li>
              </ol>
              <p className="text-xs text-muted-foreground">{t("manualTip")}</p>
            </div>
          ) : null}

          {!loading && !secret ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => void loadSetup(true)}
            >
              {t("startOver")}
            </Button>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">{t("enterCode")}</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) =>
                  setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                disabled={busy || !secret}
              />
            </div>
            {error && secret ? (
              <div
                role="alert"
                className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={busy || !secret || token.length !== 6}
            >
              {submitting ? t("verifying") : t("continue")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
