"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { forcePasswordChange } from "@/lib/actions/password";
import { getPostAuthRedirect } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForcePasswordChangePage() {
  const t = useTranslations("auth.forcePasswordChange");
  const locale = useLocale();
  const { data: session, update } = useSession();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await forcePasswordChange(formData);

    if (!result.success) {
      setError(t(`errors.${result.error}`));
      setLoading(false);
      return;
    }

    await update({ requiresPasswordChange: false });

    const user = session?.user;
    const target = getPostAuthRedirect(locale, {
      requiresPasswordChange: false,
      needs2FASetup: user?.needs2FASetup,
      twoFactorVerified: user?.twoFactorVerified,
      role: user!.role,
    });

    window.location.href = target;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("newPassword")}</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "..." : t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
