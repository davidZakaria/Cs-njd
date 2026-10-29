/** Resolve the human-readable label for a controlled select value. */
export function selectOptionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function selectOptionItems(
  options: ReadonlyArray<{ value: string; label: string }>
): Record<string, string> {
  return Object.fromEntries(options.map((option) => [option.value, option.label]));
}
