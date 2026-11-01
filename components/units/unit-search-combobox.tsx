"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { UnitRequestPickerOption } from "@/lib/units/unit-request-search";
import { cn } from "@/lib/utils";

type UnitSearchComboboxProps = {
  id?: string;
  label: string;
  placeholder: string;
  emptyHint: string;
  value: UnitRequestPickerOption | null;
  onChange: (value: UnitRequestPickerOption | null) => void;
  onSearch: (query: string) => Promise<UnitRequestPickerOption[]>;
  onResolveUnit?: (unitId: string) => Promise<UnitRequestPickerOption | null>;
  initialUnitId?: string;
  disabled?: boolean;
};

export function UnitSearchCombobox({
  id: idProp,
  label,
  placeholder,
  emptyHint,
  value,
  onChange,
  onSearch,
  onResolveUnit,
  initialUnitId,
  disabled,
}: UnitSearchComboboxProps) {
  const tCommon = useTranslations("common");
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const listboxId = `${inputId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnitRequestPickerOption[]>([]);
  const [pending, startTransition] = useTransition();

  const runSearch = useCallback(
    (nextQuery: string) => {
      startTransition(async () => {
        const rows = await onSearch(nextQuery);
        setResults(rows);
      });
    },
    [onSearch]
  );

  useEffect(() => {
    if (!initialUnitId || value || !onResolveUnit) return;
    let cancelled = false;
    void onResolveUnit(initialUnitId).then((option) => {
      if (!cancelled && option) onChange(option);
    });
    return () => {
      cancelled = true;
    };
  }, [initialUnitId, onChange, onResolveUnit, value]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      runSearch(query);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [open, query, runSearch]);

  function handleSelect(option: UnitRequestPickerOption) {
    onChange(option);
    setOpen(false);
    setQuery("");
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setResults([]);
    }
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={inputId}>
        {label}
      </label>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          id={inputId}
          disabled={disabled}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          role="combobox"
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors",
            "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate text-start">
            {value ? value.label : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--anchor-width)] min-w-72 p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              value={query}
              onValueChange={setQuery}
              aria-controls={listboxId}
            />
            <CommandList id={listboxId} role="listbox">
              <CommandEmpty>
                {pending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {tCommon("loading")}
                  </span>
                ) : query.trim().length < 2 ? (
                  emptyHint
                ) : (
                  tCommon("noResults")
                )}
              </CommandEmpty>
              <CommandGroup>
                {results.map((option) => (
                  <CommandItem
                    key={option.unitId}
                    value={option.label}
                    onSelect={() => handleSelect(option)}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        value?.unitId === option.unitId
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
