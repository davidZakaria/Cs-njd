"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ArrowLeftRight, Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";

import {
  getUnitSwapPreview,
  searchEmptyUnitsForSwap,
  swapUnitClient,
  type SwapTargetUnitResult,
} from "@/lib/actions/unit-swap";
import type { UnitSwapPreview } from "@/lib/units/unit-swap";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function UnitSwapDialog({
  sourceUnitId,
  sourceUnitCode,
  hasClient,
}: {
  sourceUnitId: string;
  sourceUnitCode: string;
  hasClient: boolean;
}) {
  const t = useTranslations("units.swap");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"search" | "confirm">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SwapTargetUnitResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SwapTargetUnitResult | null>(null);
  const [preview, setPreview] = useState<UnitSwapPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const runSearch = useCallback(
    async (value: string) => {
      setSearching(true);
      try {
        const rows = await searchEmptyUnitsForSwap(value, sourceUnitId);
        setResults(rows);
      } finally {
        setSearching(false);
      }
    },
    [sourceUnitId]
  );

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      runSearch(query);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [open, query, runSearch]);

  useEffect(() => {
    if (!open) {
      setStep("search");
      setQuery("");
      setSelected(null);
      setPreview(null);
      setPreviewError(null);
    }
  }, [open]);

  async function goToConfirm(target: SwapTargetUnitResult) {
    setSelected(target);
    setPreviewError(null);
    const result = await getUnitSwapPreview(sourceUnitId, target.unitId);
    if (!result.success || !result.preview) {
      setPreviewError(result.success ? t("targetBlocked") : result.error);
      return;
    }
    setPreview(result.preview);
    setStep("confirm");
  }

  function handleConfirm() {
    if (!selected) return;
    startTransition(async () => {
      const result = await swapUnitClient(sourceUnitId, selected.unitId);
      if (result.success) {
        toast.success(t("success"));
        setOpen(false);
        router.push(`/units/${selected.unitId}`);
        router.refresh();
      } else {
        toast.error(result.error || tCommon("actionFailed"));
      }
    });
  }

  if (!hasClient) return null;

  const contractFlagCount =
    (preview?.contractFlags.length ?? 0) + (preview?.finishingNeedsUpdate ? 1 : 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="gap-2" />
        }
      >
        <ArrowLeftRight className="size-4" />
        {t("action")}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {step === "search" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="swap-target-search">{t("searchLabel")}</Label>
              <div className="relative">
                <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="swap-target-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="ps-9"
                  autoComplete="off"
                />
              </div>
              <p className="text-xs text-muted-foreground">{sourceUnitCode}</p>
            </div>
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
              {searching ? (
                <li className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </li>
              ) : results.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </li>
              ) : (
                results.map((row) => (
                  <li key={row.unitId}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full flex-col items-start rounded-md px-3 py-2 text-start text-sm hover:bg-muted"
                      )}
                      onClick={() => goToConfirm(row)}
                    >
                      <span className="font-medium">{row.unitCode}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.projectName}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            {previewError ? (
              <p className="text-sm text-destructive">{previewError}</p>
            ) : null}
          </div>
        ) : preview && selected ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium">{t("confirmTitle")}</p>
            <p>
              {t("confirmBody", {
                targetUnit: selected.unitCode,
                targetProject: selected.projectName,
              })}
            </p>
            <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
              <li>{t("summaryClient", { name: preview.primaryClientName })}</li>
              <li>{t("summaryCoOwners", { count: preview.coOwnerCount })}</li>
              <li>{t("summaryTickets", { count: preview.ticketCount })}</li>
              <li>
                {t("summaryContracts", { count: contractFlagCount })}
              </li>
            </ul>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "confirm" ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setStep("search")}
            >
              {t("back")}
            </Button>
          ) : null}
          {step === "confirm" ? (
            <Button type="button" disabled={pending} onClick={handleConfirm}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("confirmButton")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
