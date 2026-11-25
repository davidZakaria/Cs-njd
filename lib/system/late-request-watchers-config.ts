import { SYSTEM_SETTING_KEYS } from "@/lib/system/settings-keys";

export const LATE_REQUEST_WATCHERS_KEY = SYSTEM_SETTING_KEYS.LATE_REQUEST_WATCHERS;

export type LateRequestWatchersConfig = {
  include: string[];
  exclude: string[];
};

export const EMPTY_LATE_REQUEST_WATCHERS_CONFIG: LateRequestWatchersConfig = {
  include: [],
  exclude: [],
};

export function serializeLateRequestWatchersValue(
  config: LateRequestWatchersConfig
): string {
  const include = [...new Set(config.include.map((id) => id.trim()).filter(Boolean))];
  const exclude = [...new Set(config.exclude.map((id) => id.trim()).filter(Boolean))];
  return JSON.stringify({ include, exclude } satisfies LateRequestWatchersConfig);
}

export function parseLateRequestWatchersValue(
  raw: string | undefined | null
): LateRequestWatchersConfig {
  if (!raw?.trim()) {
    return { ...EMPTY_LATE_REQUEST_WATCHERS_CONFIG };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LateRequestWatchersConfig>;
    const include = Array.isArray(parsed.include)
      ? [...new Set(parsed.include.filter((id): id is string => typeof id === "string"))]
      : [];
    const exclude = Array.isArray(parsed.exclude)
      ? [...new Set(parsed.exclude.filter((id): id is string => typeof id === "string"))]
      : [];
    return { include, exclude };
  } catch {
    return { ...EMPTY_LATE_REQUEST_WATCHERS_CONFIG };
  }
}