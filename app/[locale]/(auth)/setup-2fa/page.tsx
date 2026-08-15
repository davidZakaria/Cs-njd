"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import {
  confirmSetup2FA,
  getSetup2FAData,
  resetMy2FASetup,
} from "@/lib/actions/two-factor";
import { getPostAuthRedirect } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";

export default function Setup2FAPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { data: session, status, update } = useSession();
  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadSetup = useCallback(async (forceReset = false) => {
    setLoading(true);
    setError("");
    if (forceReset) {
      await resetMy2FASetup();
    }
    const result = await getSetup2FAData();
    if (!result.success) {
      setError(result.error);
      setSecret("");
      setQrDataUrl("");
      setLoading(false);
      return;
    }
    setSecret(result.secret ?? "");
    setQrDataUrl(result.qrDataUrl ?? "");
    setToken("");
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void loadSetup();
    }
  }, [status, loadSetup]);

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
    const result = await confirmSetup2FA(secret, token);
    if (!result.success) {
      setError(result.error ?? t("invalidCode"));
      return;
    }
    await update({
      needs2FASetup: false,
      is2FAEnabled: true,
      twoFactorVerified: true,
    });
    window.location.href = getPostAuthRedirect(locale, {
      requiresPasswordChange: session?.user.requiresPasswordChange ?? false,
      needs2FASetup: false,
      twoFactorVerified: true,
      role: session!.user.role,
    });
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
            <p className="text-center text-sm text-muted-foreground">{t("loadingQr")}</p>
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
              <p className="text-sm text-destructive">{error || t("qrLoadFailed")}</p>
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
                onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                disabled={loading}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading || !secret}>
              {t("continue")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
