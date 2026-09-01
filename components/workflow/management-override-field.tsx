"use client";

import { useTranslations } from "next-intl";

export function ManagementOverrideCheckbox({
  visible,
  checked,
  onCheckedChange,
}: {
  visible: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const tWorkflow = useTranslations("workflow");

  if (!visible) return null;

  return (
    <>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="size-3.5 rounded border"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />
        {tWorkflow("override.title")}
      </label>
      {checked ? (
        <input type="hidden" name="managementOverride" value="true" />
      ) : null}
    </>
  );
}

export function confirmManagementOverride(
  status: string,
  overrideChecked: boolean,
  confirmMessage: string
): boolean {
  if (status !== "RESOLVED" || !overrideChecked) return true;
  return window.confirm(confirmMessage);
}
