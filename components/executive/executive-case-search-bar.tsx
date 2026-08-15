"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ExecutiveCaseSearchBar({
  query,
  onQueryChange,
  title,
  subtitle,
  placeholder,
  totalMatches,
  totalCases,
  teamMatches,
  myMatches,
  teamLabel,
  myLabel,
  className,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  title: string;
  subtitle: string;
  placeholder: string;
  totalMatches: number;
  totalCases: number;
  teamMatches?: number;
  myMatches?: number;
  teamLabel?: string;
  myLabel?: string;
  className?: string;
}) {
  const t = useTranslations("executive");
  const tCommon = useTranslations("common");
  const isSearching = query.trim().length > 0;

  return (
    <Card
      className={cn(
        "overflow-hidden border-0 bg-gradient-to-br from-[var(--color-chart-1)]/10 via-card to-card shadow-md",
        "ring-1 ring-[var(--color-chart-1)]/20",
        className
      )}
    >
      <CardHeader className="border-b border-[var(--color-chart-1)]/10 bg-[var(--color-chart-1)]/[0.04] pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight">
              {title}
            </CardTitle>
            <CardDescription className="max-w-xl text-sm">
              {subtitle}
            </CardDescription>
          </div>
          <div className="relative w-full lg:max-w-md lg:shrink-0">
            <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-[var(--color-chart-1)] start-3.5" />
            <Input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              className={cn(
                "h-10 rounded-xl border-[var(--color-chart-1)]/20 bg-background/90 ps-10 pe-10",
                "shadow-inner placeholder:text-muted-foreground/80",
                "focus-visible:border-[var(--color-chart-1)]/40 focus-visible:ring-[var(--color-chart-1)]/25"
              )}
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 size-8 -translate-y-1/2 rounded-lg end-1.5"
                onClick={() => onQueryChange("")}
                aria-label={tCommon("cancel")}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {isSearching ? (
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tabular-nums",
              totalMatches > 0
                ? "bg-[var(--color-chart-1)]/12 text-[var(--color-chart-1)]"
                : "bg-muted text-muted-foreground"
            )}
          >
            {totalMatches === 0
              ? t("searchNoResults")
              : t("searchResults", { count: totalMatches, total: totalCases })}
          </span>
          {totalMatches > 0 && teamLabel != null && teamMatches != null ? (
            <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground">
              {teamLabel}: {teamMatches}
            </span>
          ) : null}
          {totalMatches > 0 && myLabel != null && myMatches != null ? (
            <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground">
              {myLabel}: {myMatches}
            </span>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
