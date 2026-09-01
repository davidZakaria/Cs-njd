"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  searchUnitsSpotlight,
  type SpotlightSearchResult,
} from "@/lib/actions/spotlight-search";
import { useRouter } from "@/i18n/navigation";

export function GlobalSpotlight() {
  const t = useTranslations("actions");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotlightSearchResult[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const runSearch = useCallback((value: string) => {
    setQuery(value);
    startTransition(async () => {
      const items = await searchUnitsSpotlight(value);
      setResults(items);
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
    runSearch("");
  }, [open, runSearch]);

  function navigate(unitId: string) {
    setOpen(false);
    router.push(`/units/${unitId}`);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("searchShortcut")}
      description={t("searchShortcut")}
    >
      <CommandInput
        placeholder={t("searchPlaceholder")}
        value={query}
        onValueChange={runSearch}
      />
      <CommandList>
        <CommandEmpty>
          {pending ? tCommon("loading") : tCommon("noResults")}
        </CommandEmpty>
        <CommandGroup heading={t("searchGroupUnits")}>
          {results.map((item) => (
            <CommandItem
              key={item.unitId}
              value={`${item.unitCode} ${item.clientName} ${item.projectName}`}
              onSelect={() => navigate(item.unitId)}
            >
              <Building2 className="text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.unitCode}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.clientName} · {item.projectName}
                </p>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
