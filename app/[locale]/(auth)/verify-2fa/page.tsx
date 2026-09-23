"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getSession, useSession } from "next-auth/react";
import { AlertCircle, Clock, Loader2, RefreshCw } from "lucide-react";

import {
  getPostAuthRedirect,
  resolveLocale,
} from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/actions/result";
type TwoFactorResetStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected"
  | "ready";

const VERIFY_ERROR_CODES = [
  "SESSION_EXPIRED",
  "CODE_REQUIRED",
  "CODE_LENGTH",
  "NOT_CONFIGURED",
  "INVALID_CODE",
  "RATE_LIMITED",
  "Unauthorized",
] as const;

type VerifyErrorCode = (typeof VERIFY_ERROR_CODES)[number];

function isVerifyErrorCode(value: string): value is VerifyErrorCode {
  return VERIFY_ERROR_CODES.includes(value as VerifyErrorCode);
}

async function postAuthJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  return (await response.json()) as T;
}

async function fetchResetStatus(): Promise<{
  status: TwoFactorResetStatus;
  needsEnrollment: boolean;
}> {
  const response = await fetch("/api/auth/2fa-reset-status", {
    credentials: "include",
    cache: "no-store",
  });
  const data = (await response.json()) as {
    status?: TwoFactorResetStatus;
    needsEnrollment?: boolean;
  };
  return {
    status: data.status ?? "none",
    needsEnrollment: data.needsEnrollment ?? false,
  };
}

export default function Verify2FAPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { update } = useSession();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);
  const [resetStatus, setResetStatus] = useState<TwoFactorResetStatus>("none");
  const [needsEnrollment, setNeedsEnrollment] = useState(false);

  const goToSetup = useCallback(async () => {
    await update({
      needs2FASetup: true,
      is2FAEnabled: false,
      twoFactorVerified: false,
    });

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const session = await getSession();
      if (
        session?.user?.needs2FASetup &&
        !session.user.twoFactorVerified
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    window.location.assign(`/${resolveLocale(locale)}/setup-2fa`);
  }, [locale, update]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const result = await fetchResetStatus();
      if (cancelled) return;
      setResetStatus(result.status);
      setNeedsEnrollment(result.needsEnrollment);
      if (result.status === "ready" || result.needsEnrollment) {
        await goToSetup();
      }
    }

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [goToSetup]);

  function resolveVerifyError(code: string | undefined): string {
    if (!code) return t("verifyFailed");
    if (code === "Unauthorized") {
      return t("verifyErrors.SESSION_EXPIRED");
    }
    if (isVerifyErrorCode(code)) {
      return t(`verifyErrors.${code}`);
    }
    return code;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const result = await postAuthJson<ActionResult>("/api/auth/verify-2fa", {
        token,
      });

      if (!result.success) {
        setError(resolveVerifyError(result.error));
        return;
      }

      await update({ twoFactorVerified: true });

      const refreshed = await getSession();
      if (!refreshed?.user?.role) {
        setError(t("verifyErrors.SESSION_EXPIRED"));
        return;
      }

      window.location.assign(
        getPostAuthRedirect(resolveLocale(locale), {
          requiresPasswordChange: refreshed.user.requiresPasswordChange ?? false,
          needs2FASetup: refreshed.user.needs2FASetup ?? false,
          twoFactorVerified: true,
          role: refreshed.user.role,
        })
      );
    } catch {
      setError(t("verifyUnexpectedError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestReset() {
    if (!window.confirm(t("resetAuthenticatorConfirm"))) {
      return;
    }

    setRequestingReset(true);
    setError("");

    try {
      const result = await postAuthJson<ActionResult>(
        "/api/auth/request-2fa-reset"
      );

      if (!result.success) {
        if (result.error === "NOT_CONFIGURED") {
          await goToSetup();
          return;
        }
        setError(resolveVerifyError(result.error));
        return;
      }

      const enrollmentCheck = await fetchResetStatus();
      if (enrollmentCheck.needsEnrollment || enrollmentCheck.status === "ready") {
        await goToSetup();
        return;
      }

      setResetStatus("pending");
    } catch {
      setError(t("resetAuthenticatorFailed"));
    } finally {
      setRequestingReset(false);
    }
  }

  const busy = submitting || requestingReset;
  const resetPending = resetStatus === "pending";
  const resetRejected = resetStatus === "rejected";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("verify2fa")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("verify2faHint")}</p>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t("verifyTipsTitle")}</p>
            <ul className="mt-2 list-disc space-y-1 ps-4">
              <li>{t("verifyTip1")}</li>
              <li>{t("verifyTip2")}</li>
              <li>{t("verifyTip3")}</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">{t("enterCode")}</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (error) setError("");
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                disabled={busy}
                placeholder="000000"
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy || token.length !== 6}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("verifying")}
                </>
              ) : (
                t("continue")
              )}
            </Button>
          </form>

          <div className="space-y-2 border-t pt-4">
            {needsEnrollment ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("continueToQrSetupHint")}
                </p>
                <Button
                  type="button"
                  className="w-full"
                  disabled={busy}
                  onClick={() => void goToSetup()}
                >
                  {t("continueToQrSetup")}
                </Button>
              </>
            ) : (
              <>
            <p className="text-sm font-medium">{t("lostAuthenticatorTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {t("lostAuthenticatorDescription")}
            </p>

            {resetPending ? (
              <div className="flex gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p>{t("resetAuthenticatorPending")}</p>
              </div>
            ) : null}

            {resetRejected ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {t("resetAuthenticatorRejected")}
              </div>
            ) : null}

            {!resetPending ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => void handleRequestReset()}
              >
                {requestingReset ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("resettingAuthenticator")}
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-4" />
                    {t("resetAuthenticator")}
                  </>
                )}
              </Button>
            ) : null}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
