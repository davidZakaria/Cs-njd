"use client";

import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Construction } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MaintenancePage() {
  const t = useTranslations("maintenance");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  return (
    <div
      className="flex min-h-svh items-center justify-center bg-muted/30 p-4"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <Card className="w-full max-w-lg shadow-premium">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <Construction className="size-7" />
          </div>
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground">{t("description")}</p>
          <p className="text-sm text-muted-foreground">{t("contactHint")}</p>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
          >
            {tCommon("signOut")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
