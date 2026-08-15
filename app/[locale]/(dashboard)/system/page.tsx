"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { checkUpdatesAction } from "@/lib/actions/system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SystemPage() {
  const t = useTranslations("system");
  const [result, setResult] = useState<{
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    message: string;
  } | null>(null);

  async function handleCheck() {
    const res = await checkUpdatesAction();
    setResult(res);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("checkUpdates")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>{t("currentVersion")}: 1.0.0</p>
          <Button onClick={handleCheck}>{t("checkUpdates")}</Button>
          {result && (
            <div className="rounded-md border p-4 text-sm">
              <p>{result.message}</p>
              <p>Current: {result.currentVersion}</p>
              <p>Latest: {result.latestVersion}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
