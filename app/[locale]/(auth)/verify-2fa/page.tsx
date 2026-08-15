"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { verify2FA } from "@/lib/actions/two-factor";
import { getPostAuthRedirect } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Verify2FAPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { data: session, update } = useSession();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await verify2FA(token);
    if (!result.success) {
      setError(result.error ?? "Invalid code");
      return;
    }
    await update({ twoFactorVerified: true });
    window.location.href = getPostAuthRedirect(locale, {
      requiresPasswordChange: session?.user.requiresPasswordChange ?? false,
      needs2FASetup: session?.user.needs2FASetup ?? false,
      twoFactorVerified: true,
      role: session!.user.role,
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("verify2fa")}</CardTitle>
        </CardHeader>
        <CardContent>
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
