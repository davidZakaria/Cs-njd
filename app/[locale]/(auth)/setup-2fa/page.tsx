"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { confirmSetup2FA, getSetup2FAData } from "@/lib/actions/two-factor";
import { getPostAuthRedirect } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

export default function Setup2FAPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { data: session, update } = useSession();
  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getSetup2FAData().then((data) => {
      setSecret(data.secret);
      setQrDataUrl(data.qrDataUrl);
    }).catch(() => setError("Unable to load 2FA setup. Please sign in again."));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await confirmSetup2FA(secret, token);
    if (!result.success) {
      setError(result.error ?? "Invalid code");
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
          {qrDataUrl && (
            <Image src={qrDataUrl} alt="QR Code" width={200} height={200} className="mx-auto" unoptimized />
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">{t("enterCode")}</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                maxLength={6}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full">
              {t("continue")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
