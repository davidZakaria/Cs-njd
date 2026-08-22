"use client";

import { Download } from "lucide-react";

import {
  buildCsvWithBom,
  csvFilename,
  downloadCsvFile,
} from "@/lib/export/csv";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ExportCsvButton({
  label,
  filenamePrefix,
  headers,
  rows,
  disabled,
  className,
}: {
  label: string;
  filenamePrefix: string;
  headers: string[];
  rows: string[][];
  disabled?: boolean;
  className?: string;
}) {
  function handleExport() {
    if (rows.length === 0) return;
    const csv = buildCsvWithBom(headers, rows);
    downloadCsvFile(csvFilename(filenamePrefix), csv);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1.5", className)}
      disabled={disabled || rows.length === 0}
      onClick={handleExport}
    >
      <Download className="size-4" />
      {label}
    </Button>
  );
}
