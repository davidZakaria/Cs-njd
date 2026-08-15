"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { importWorkbookAction } from "@/lib/actions/import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImportResult } from "@/lib/import/ingest";

export default function ImportsPage() {
  const t = useTranslations("imports");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await importWorkbookAction(formData);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("dropzone")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="file"
              name="file"
              accept=".xlsx,.xls,.csv"
              required
              className="block w-full text-sm"
            />
            <Button type="submit" disabled={loading}>
              {loading ? "..." : t("import")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{t("results")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{t("safeImportNote")}</p>
            <p>Created: {result.created}</p>
            <p>Updated: {result.updated}</p>
            <p>Skipped: {result.skipped}</p>
            <p>Cases created: {result.ticketsCreated}</p>
            <p>Cases updated: {result.ticketsUpdated}</p>
            <p>Cases skipped (unchanged): {result.ticketsSkipped}</p>
            <p>Units assigned from Excel: {result.unitsAssigned}</p>
            <p>Cases assigned from Excel: {result.ticketsAssigned}</p>
            <p>Unknown Excel agents (left unassigned): {result.agentsUnresolved}</p>
            {result.unmatchedAgentNames.length > 0 && (
              <p className="text-muted-foreground">
                Unmatched names: {result.unmatchedAgentNames.slice(0, 8).join(", ")}
                {result.unmatchedAgentNames.length > 8 ? "…" : ""}
              </p>
            )}
            <p>Errors: {result.errors.length}</p>
            {result.errors.slice(0, 20).map((error, idx) => (
              <p key={idx} className="text-destructive">
                {error.sheet} row {error.row}: {error.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
