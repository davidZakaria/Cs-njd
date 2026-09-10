import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  authRateLimitKey,
  checkRateLimit,
  recordFailure,
  clearFailures,
  AUTH_RATE_LIMIT_ERROR,
} from "@/lib/security/rate-limit";

describe("Rate Limiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearFailures("test:192.168.1.1");
    clearFailures("login:192.168.1.1");
    clearFailures("2fa:192.168.1.1");
  });

  describe("authRateLimitKey", () => {
    it("creates key with login scope", () => {
      expect(authRateLimitKey("login", "192.168.1.1")).toBe("login:192.168.1.1");
    });

    it("creates key with 2fa scope", () => {
      expect(authRateLimitKey("2fa", "192.168.1.1")).toBe("2fa:192.168.1.1");
    });

    it("handles undefined IP", () => {
      expect(authRateLimitKey("login", undefined)).toBe("login:unknown");
    });
  });

  describe("checkRateLimit", () => {
    it("allows requests with no prior failures", () => {
      const result = checkRateLimit("login:192.168.1.1");
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBeUndefined();
    });

    it("allows requests under the limit", () => {
      const key = "login:192.168.1.1";
      recordFailure(key);
      recordFailure(key);
      recordFailure(key);
      recordFailure(key);
      expect(checkRateLimit(key).allowed).toBe(true);
    });

    it("blocks after 5 failures", () => {
      const key = "login:192.168.1.1";
      for (let i = 0; i < 5; i++) {
        recordFailure(key);
      }
      const result = checkRateLimit(key);
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it("resets after window expires", () => {
      const key = "login:192.168.1.1";
      for (let i = 0; i < 5; i++) {
        recordFailure(key);
      }
      expect(checkRateLimit(key).allowed).toBe(false);

      vi.advanceTimersByTime(15 * 60 * 1000 + 1);

      expect(checkRateLimit(key).allowed).toBe(true);
    });
  });

  describe("recordFailure", () => {
    it("increments failure count", () => {
      const key = "login:192.168.1.1";
      recordFailure(key);
      expect(checkRateLimit(key).allowed).toBe(true);

      recordFailure(key);
      recordFailure(key);
      recordFailure(key);
      expect(checkRateLimit(key).allowed).toBe(true);

      recordFailure(key);
      expect(checkRateLimit(key).allowed).toBe(false);
    });

    it("creates new entry after window expires", () => {
      const key = "login:192.168.1.1";
      for (let i = 0; i < 5; i++) {
        recordFailure(key);
      }
      expect(checkRateLimit(key).allowed).toBe(false);

      vi.advanceTimersByTime(15 * 60 * 1000 + 1);

      recordFailure(key);
      expect(checkRateLimit(key).allowed).toBe(true);
    });
  });

  describe("clearFailures", () => {
    it("resets rate limit for key", () => {
      const key = "login:192.168.1.1";
      for (let i = 0; i < 5; i++) {
        recordFailure(key);
      }
      expect(checkRateLimit(key).allowed).toBe(false);

      clearFailures(key);
      expect(checkRateLimit(key).allowed).toBe(true);
    });

    it("does not affect other keys", () => {
      const key1 = "login:192.168.1.1";
      const key2 = "login:192.168.1.2";

      for (let i = 0; i < 5; i++) {
        recordFailure(key1);
        recordFailure(key2);
      }

      clearFailures(key1);
      expect(checkRateLimit(key1).allowed).toBe(true);
      expect(checkRateLimit(key2).allowed).toBe(false);
    });
  });

  describe("AUTH_RATE_LIMIT_ERROR", () => {
    it("exports the error constant", () => {
      expect(AUTH_RATE_LIMIT_ERROR).toBe("RATE_LIMITED");
    });
  });
});
