const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

function pruneExpired(now: number) {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function authRateLimitKey(scope: "login" | "2fa", ip: string | undefined): string {
  return `${scope}:${ip ?? "unknown"}`;
}

export function checkRateLimit(key: string): {
  allowed: boolean;
  retryAfterMs?: number;
} {
  const now = Date.now();
  pruneExpired(now);

  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    return { allowed: true };
  }

  if (entry.count >= MAX_FAILURES) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  return { allowed: true };
}

export function recordFailure(key: string): void {
  const now = Date.now();
  pruneExpired(now);

  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.count += 1;
  store.set(key, entry);
}

export function clearFailures(key: string): void {
  store.delete(key);
}

export const AUTH_RATE_LIMIT_ERROR = "RATE_LIMITED";
